/**
 * @file controllers/paymentController.js
 * @description Payment endpoints. Part of Transaction Scenario 1.
 *
 * IMPORTANT: Payment amount is always calculated SERVER-SIDE from the database.
 * It is never accepted from the client to prevent tampering.
 *
 * Roles: Cashier (role_id 3) for create; any auth for read.
 */

'use strict';

const { getPool, getTransaction, sql } = require('../config/database');
const { createError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

/**
 * POST /api/v1/payments
 * Creates a payment for an existing order.
 *
 * @route POST /api/v1/payments
 * @access Cashier (role_id 3)
 *
 * Request body: { order_id: number, method: 'Cash'|'Card'|'Online' }
 *
 * Transaction flow:
 *   BEGIN
 *   Verify order exists and has no existing payment (UNIQUE constraint on Payment.order_id)
 *   Calculate total: SUM(oi.quantity * d.price) from OrderItem JOIN MenuDish
 *   INSERT INTO Payment (order_id, amount, method)
 *   COMMIT
 *   ROLLBACK on any failure
 *
 * Response 201: { success: true, payment_id, amount, method }
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function createPayment(req, res, next) {
    const { order_id, method } = req.body;
    const transaction = await getTransaction();

    try {
        await transaction.begin();
        logger.info('BEGIN TRANSACTION [CREATE_PAYMENT]', { order_id, method });

        // Verify order exists
        const orderCheck = await new sql.Request(transaction)
            .input('order_id', sql.Int, order_id)
            .query('SELECT order_id FROM [Order] WHERE order_id = @order_id');
        if (orderCheck.recordset.length === 0) {
            throw createError(404, `Order ${order_id} not found`);
        }

        // Check no duplicate payment (belt-and-suspenders before DB constraint)
        const dupCheck = await new sql.Request(transaction)
            .input('order_id', sql.Int, order_id)
            .query('SELECT payment_id FROM Payment WHERE order_id = @order_id');
        if (dupCheck.recordset.length > 0) {
            throw createError(409, `Order ${order_id} has already been paid`);
        }

        // Calculate total server-side (never trust client amount)
        const totalResult = await new sql.Request(transaction)
            .input('order_id', sql.Int, order_id)
            .query(`
        SELECT SUM(oi.quantity * d.price) AS total
        FROM OrderItem oi
        JOIN MenuDish d ON oi.dish_id = d.dish_id
        WHERE oi.order_id = @order_id
      `);

        const amount = parseFloat(totalResult.recordset[0]?.total || 0);
        if (amount <= 0) {
            throw createError(400, `Order ${order_id} has no items or zero total`);
        }

        // INSERT Payment
        const paymentResult = await new sql.Request(transaction)
            .input('order_id', sql.Int, order_id)
            .input('amount', sql.Decimal(10, 2), amount)
            .input('method', sql.NVarChar(20), method)
            .query(`
        INSERT INTO Payment (order_id, amount, method)
        OUTPUT INSERTED.payment_id
        VALUES (@order_id, @amount, @method)
      `);

        const payment_id = paymentResult.recordset[0].payment_id;

        await transaction.commit();
        logger.logCommit('CREATE_PAYMENT', { payment_id, order_id, amount, method });

        res.status(201).json({ success: true, payment_id, order_id, amount, method });
    } catch (err) {
        try { await transaction.rollback(); } catch (_) { }
        logger.logRollback('CREATE_PAYMENT', err, { order_id });
        next(err.statusCode ? err : createError(500, `Payment creation failed: ${err.message}`));
    }
}

/**
 * GET /api/v1/payments
 * Returns all payments with order and customer info.
 *
 * @route GET /api/v1/payments
 * @access Any authenticated user
 *
 * SQL: SELECT p.*, o.order_time, c.name FROM Payment p JOIN [Order] o JOIN Customer c
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getPayments(req, res, next) {
    try {
        const pool = getPool();
        const { method } = req.query;
        let where = '';
        const request = pool.request();

        if (method) {
            where = 'WHERE p.method = @method';
            request.input('method', sql.NVarChar(20), method);
        }

        const result = await request.query(`
      SELECT p.payment_id, p.order_id, p.amount, p.method,
             o.order_time, o.customer_id,
             c.name AS customer_name
      FROM Payment p
      JOIN [Order] o ON p.order_id = o.order_id
      JOIN Customer c ON o.customer_id = c.customer_id
      ${where}
      ORDER BY p.payment_id DESC
    `);

        res.json({ success: true, count: result.recordset.length, payments: result.recordset });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/v1/payments/:id
 * Returns a single payment with full order details.
 *
 * @route GET /api/v1/payments/:id
 * @access Any authenticated user
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getPaymentById(req, res, next) {
    try {
        const pool = getPool();
        const payment_id = parseInt(req.params.id);

        const result = await pool
            .request()
            .input('payment_id', sql.Int, payment_id)
            .query(`
        SELECT p.payment_id, p.amount, p.method,
               o.order_id, o.order_time,
               c.customer_id, c.name AS customer_name, c.phone, c.email,
               e.name AS employee_name
        FROM Payment p
        JOIN [Order] o ON p.order_id = o.order_id
        JOIN Customer c ON o.customer_id = c.customer_id
        JOIN Employee e ON o.employee_id = e.employee_id
        WHERE p.payment_id = @payment_id
      `);

        if (result.recordset.length === 0) {
            return next(createError(404, `Payment ${payment_id} not found`));
        }

        res.json({ success: true, payment: result.recordset[0] });
    } catch (err) {
        next(err);
    }
}

module.exports = { createPayment, getPayments, getPaymentById };
