/**
 * @file controllers/orderController.js
 * @description Order management endpoints.
 *
 * TRANSACTION SCENARIO 1: Create order with items (and optional payment).
 * -----------------------------------------------------------------
 * BEGIN TRANSACTION
 *   INSERT INTO [Order] (order_time, customer_id, employee_id) → get order_id
 *   FOR EACH item: INSERT INTO OrderItem (order_id, dish_id, quantity)
 * COMMIT
 * ROLLBACK on any failure – logged to transactions.log
 * -----------------------------------------------------------------
 *
 * Roles:
 *   - POST/PUT: Waiter (role_id 2)
 *   - GET: Any authenticated user
 */

'use strict';

const { getPool, getTransaction, sql } = require('../config/database');
const { createError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

/**
 * POST /api/v1/orders
 * Creates a new order with one or more items inside a single SQL transaction.
 *
 * @route POST /api/v1/orders
 * @access Waiter (role_id 2)
 *
 * Request body:
 *   {
 *     customer_id: number,      – must exist in Customer table
 *     employee_id: number,      – must exist in Employee table
 *     items: [{ dish_id: number, quantity: number }]
 *   }
 *
 * Response 201:
 *   { success: true, order_id: number, item_count: number }
 *
 * Transaction flow:
 *   BEGIN
 *   INSERT INTO [Order] → capture order_id via OUTPUT INSERTED
 *   INSERT INTO OrderItem for each item
 *   COMMIT (all or nothing)
 *   ROLLBACK + log on any error
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function createOrder(req, res, next) {
    const { customer_id, employee_id, items } = req.body;
    const transaction = await getTransaction();

    try {
        // ── BEGIN TRANSACTION ──────────────────────────────────────────
        await transaction.begin();
        logger.info('BEGIN TRANSACTION [CREATE_ORDER]', { customer_id, employee_id, items });

        // Verify customer exists
        const custCheck = await new sql.Request(transaction)
            .input('cid', sql.Int, customer_id)
            .query('SELECT customer_id FROM Customer WHERE customer_id = @cid');
        if (custCheck.recordset.length === 0) {
            throw createError(404, `Customer ${customer_id} not found`);
        }

        // Verify employee exists
        const empCheck = await new sql.Request(transaction)
            .input('eid', sql.Int, employee_id)
            .query('SELECT employee_id FROM Employee WHERE employee_id = @eid');
        if (empCheck.recordset.length === 0) {
            throw createError(404, `Employee ${employee_id} not found`);
        }

        // INSERT INTO [Order]
        const orderResult = await new sql.Request(transaction)
            .input('customer_id', sql.Int, customer_id)
            .input('employee_id', sql.Int, employee_id)
            .query(`
        INSERT INTO [Order] (order_time, customer_id, employee_id)
        OUTPUT INSERTED.order_id
        VALUES (SYSDATETIME(), @customer_id, @employee_id)
      `);

        const order_id = orderResult.recordset[0].order_id;

        // Verify all dishes exist and INSERT each OrderItem
        for (const item of items) {
            const dishCheck = await new sql.Request(transaction)
                .input('did', sql.Int, item.dish_id)
                .query('SELECT dish_id, price FROM MenuDish WHERE dish_id = @did');
            if (dishCheck.recordset.length === 0) {
                throw createError(404, `Dish ${item.dish_id} not found`);
            }

            await new sql.Request(transaction)
                .input('order_id', sql.Int, order_id)
                .input('dish_id', sql.Int, item.dish_id)
                .input('quantity', sql.Int, item.quantity)
                .query(`
          INSERT INTO OrderItem (order_id, dish_id, quantity)
          VALUES (@order_id, @dish_id, @quantity)
        `);
        }

        // ── COMMIT ────────────────────────────────────────────────────
        await transaction.commit();
        logger.logCommit('CREATE_ORDER', { order_id, customer_id, item_count: items.length });

        res.status(201).json({ success: true, order_id, item_count: items.length });
    } catch (err) {
        // ── ROLLBACK ──────────────────────────────────────────────────
        try {
            await transaction.rollback();
        } catch (_) { /* rollback error – pool cleans up */ }
        logger.logRollback('CREATE_ORDER', err, { customer_id, employee_id });
        next(err.statusCode ? err : createError(500, `Order creation failed: ${err.message}`));
    }
}

/**
 * GET /api/v1/orders
 * Returns all orders with optional filters. Joins Customer and Employee for names.
 *
 * @route GET /api/v1/orders
 * @access Any authenticated user
 *
 * Query params:
 *   customer_id? – filter by customer
 *   date?        – filter by order date (YYYY-MM-DD)
 *
 * SQL:
 *   SELECT o.*, c.name AS customer_name, e.name AS employee_name
 *   FROM [Order] o
 *   JOIN Customer c ON o.customer_id = c.customer_id
 *   JOIN Employee e ON o.employee_id = e.employee_id
 *   [WHERE filters]
 *   ORDER BY o.order_time DESC
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getOrders(req, res, next) {
    try {
        const pool = getPool();
        const { customer_id, date } = req.query;

        let whereClause = '';
        const request = pool.request();

        if (customer_id) {
            whereClause += ' AND o.customer_id = @customer_id';
            request.input('customer_id', sql.Int, parseInt(customer_id));
        }
        if (date) {
            whereClause += ' AND CAST(o.order_time AS DATE) = @date';
            request.input('date', sql.Date, new Date(date));
        }

        const result = await request.query(`
      SELECT
        o.order_id,
        o.order_time,
        o.customer_id,
        c.name  AS customer_name,
        o.employee_id,
        e.name  AS employee_name
      FROM [Order] o
      JOIN Customer c ON o.customer_id = c.customer_id
      JOIN Employee e ON o.employee_id = e.employee_id
      WHERE 1=1 ${whereClause}
      ORDER BY o.order_time DESC
    `);

        res.json({ success: true, count: result.recordset.length, orders: result.recordset });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/v1/orders/:id
 * Returns a single order with all its items (dish name, price, quantity).
 *
 * @route GET /api/v1/orders/:id
 * @access Any authenticated user
 *
 * SQL:
 *   SELECT o.*, c.name, e.name FROM [Order] o JOIN...
 *   UNION
 *   SELECT oi.*, d.dish_name, d.price FROM OrderItem oi JOIN MenuDish d...
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getOrderById(req, res, next) {
    try {
        const pool = getPool();
        const order_id = parseInt(req.params.id);

        // Fetch order header
        const orderResult = await pool
            .request()
            .input('order_id', sql.Int, order_id)
            .query(`
        SELECT o.order_id, o.order_time, o.customer_id,
               c.name AS customer_name, c.phone AS customer_phone,
               o.employee_id, e.name AS employee_name
        FROM [Order] o
        JOIN Customer c ON o.customer_id = c.customer_id
        JOIN Employee e ON o.employee_id = e.employee_id
        WHERE o.order_id = @order_id
      `);

        if (orderResult.recordset.length === 0) {
            return next(createError(404, `Order ${order_id} not found`));
        }

        // Fetch order items with dish details
        const itemsResult = await pool
            .request()
            .input('order_id', sql.Int, order_id)
            .query(`
        SELECT oi.order_item_id, oi.dish_id, d.dish_name,
               d.price, oi.quantity,
               (d.price * oi.quantity) AS subtotal
        FROM OrderItem oi
        JOIN MenuDish d ON oi.dish_id = d.dish_id
        WHERE oi.order_id = @order_id
      `);

        const order = orderResult.recordset[0];
        order.items = itemsResult.recordset;
        order.total = itemsResult.recordset.reduce((sum, i) => sum + parseFloat(i.subtotal), 0);

        res.json({ success: true, order });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/v1/orders/:id/process-inventory
 * TRANSACTION SCENARIO 4: Deduct ingredient inventory for a completed order.
 *
 * @route POST /api/v1/orders/:id/process-inventory
 * @access Chef (role_id 1)
 *
 * Transaction flow:
 *   BEGIN (SERIALIZABLE isolation to prevent phantom reads during stock check)
 *   For each dish in the order:
 *     SELECT ingredients from MenuDishIngredient
 *     SELECT WITH (UPDLOCK) current quantity from Inventory
 *     IF quantity < needed → THROW (triggers ROLLBACK)
 *     UPDATE Inventory SET quantity = quantity - needed
 *   COMMIT
 *   ROLLBACK if any ingredient insufficient – logs which ingredients are short
 *
 * Response 200: { success: true, deducted: [{ ingredient_id, ingredient_name, deducted_by }] }
 * Response 409: Insufficient stock for one or more ingredients
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function processInventory(req, res, next) {
    const order_id = parseInt(req.params.id);
    const transaction = await getTransaction();

    try {
        await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        logger.info('BEGIN TRANSACTION [PROCESS_INVENTORY]', { order_id });

        // Get all items in the order
        const itemsResult = await new sql.Request(transaction)
            .input('order_id', sql.Int, order_id)
            .query(`
        SELECT oi.dish_id, oi.quantity AS dish_quantity
        FROM OrderItem oi
        WHERE oi.order_id = @order_id
      `);

        if (itemsResult.recordset.length === 0) {
            throw createError(404, `Order ${order_id} not found or has no items`);
        }

        const shortages = [];
        const deducted = [];

        for (const item of itemsResult.recordset) {
            // Get ingredients required for this dish
            const ingredientsResult = await new sql.Request(transaction)
                .input('dish_id', sql.Int, item.dish_id)
                .query(`
          SELECT mdi.ingredient_id, ing.name AS ingredient_name
          FROM MenuDishIngredient mdi
          JOIN Ingredient ing ON mdi.ingredient_id = ing.ingredient_id
          WHERE mdi.dish_id = @dish_id
        `);

            for (const ing of ingredientsResult.recordset) {
                // Lock the inventory row and check current stock
                const stockResult = await new sql.Request(transaction)
                    .input('ingredient_id', sql.Int, ing.ingredient_id)
                    .query(`
            SELECT quantity
            FROM Inventory WITH (UPDLOCK)
            WHERE ingredient_id = @ingredient_id
          `);

                const currentQty = stockResult.recordset[0]?.quantity ?? 0;
                const needed = item.dish_quantity; // 1 unit per portion (simplification)

                if (currentQty < needed) {
                    shortages.push({ ingredient_id: ing.ingredient_id, ingredient_name: ing.ingredient_name, needed, available: currentQty });
                } else {
                    // Deduct from inventory
                    await new sql.Request(transaction)
                        .input('ingredient_id', sql.Int, ing.ingredient_id)
                        .input('needed', sql.Int, needed)
                        .query(`
              UPDATE Inventory
              SET quantity = quantity - @needed
              WHERE ingredient_id = @ingredient_id
            `);
                    deducted.push({ ingredient_id: ing.ingredient_id, ingredient_name: ing.ingredient_name, deducted_by: needed });
                }
            }
        }

        if (shortages.length > 0) {
            throw createError(409, 'Insufficient stock for ingredients', shortages);
        }

        await transaction.commit();
        logger.logCommit('PROCESS_INVENTORY', { order_id, deducted_count: deducted.length });

        res.json({ success: true, deducted });
    } catch (err) {
        try { await transaction.rollback(); } catch (_) { }
        logger.logRollback('PROCESS_INVENTORY', err, { order_id });
        next(err.statusCode ? err : createError(500, `Inventory processing failed: ${err.message}`));
    }
}

module.exports = { createOrder, getOrders, getOrderById, processInventory };
