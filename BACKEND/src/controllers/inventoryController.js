/**
 * @file controllers/inventoryController.js
 * @description Inventory management endpoints.
 *
 * Roles: Chef (role_id 1) for mutations; any auth for reads.
 *
 * All quantity updates use parameterised queries.
 * The CHECK constraint (quantity >= 0) on the Inventory table provides
 * a last-resort guard against negative stock at the database level.
 */

'use strict';

const { getPool, getTransaction, sql } = require('../config/database');
const { createError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

/**
 * GET /api/v1/inventory
 * Returns all inventory items with ingredient and supplier details.
 *
 * @route GET /api/v1/inventory
 * @access Any authenticated user
 *
 * SQL:
 *   SELECT inv.*, ing.name AS ingredient_name, s.name AS supplier_name, s.phone
 *   FROM Inventory inv
 *   JOIN Ingredient ing ON inv.ingredient_id = ing.ingredient_id
 *   JOIN Supplier s    ON ing.supplier_id    = s.supplier_id
 *   ORDER BY ing.name
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getInventory(req, res, next) {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT
        inv.inventory_id,
        inv.ingredient_id,
        ing.name  AS ingredient_name,
        inv.quantity,
        s.supplier_id,
        s.name    AS supplier_name,
        s.phone   AS supplier_phone
      FROM Inventory inv
      JOIN Ingredient ing ON inv.ingredient_id = ing.ingredient_id
      JOIN Supplier   s   ON ing.supplier_id   = s.supplier_id
      ORDER BY ing.name
    `);

    res.json({ success: true, count: result.recordset.length, inventory: result.recordset });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/inventory/:ingredient_id
 * Sets the quantity of a specific ingredient (absolute set, not delta).
 * Validates non-negative before issuing UPDATE.
 *
 * @route PUT /api/v1/inventory/:ingredient_id
 * @access Chef (role_id 1)
 *
 * Request body: { quantity: number (>= 0) }
 *
 * SQL: UPDATE Inventory SET quantity = @quantity WHERE ingredient_id = @ingredient_id
 *
 * Response 200: { success: true, ingredient_id, quantity }
 * Response 400: Negative quantity
 * Response 404: Ingredient not found in inventory
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function updateInventoryQuantity(req, res, next) {
  try {
    const pool = getPool();
    const ingredient_id = parseInt(req.params.ingredient_id);
    const { quantity } = req.body;

    if (quantity < 0) {
      return next(createError(400, 'Quantity cannot be negative'));
    }

    // Verify inventory record exists
    const check = await pool
      .request()
      .input('ingredient_id', sql.Int, ingredient_id)
      .query('SELECT inventory_id FROM Inventory WHERE ingredient_id = @ingredient_id');

    if (check.recordset.length === 0) {
      return next(createError(404, `No inventory record for ingredient ${ingredient_id}`));
    }

    await pool
      .request()
      .input('quantity', sql.Int, quantity)
      .input('ingredient_id', sql.Int, ingredient_id)
      .query('UPDATE Inventory SET quantity = @quantity WHERE ingredient_id = @ingredient_id');

    logger.info(`Inventory updated: ingredient ${ingredient_id} = ${quantity}`, { updated_by: req.user?.username });

    res.json({ success: true, ingredient_id, quantity });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/inventory/low-stock
 * Returns ingredients with quantity below a configurable threshold.
 *
 * @route GET /api/v1/inventory/low-stock
 * @access Any authenticated user
 *
 * Query params: threshold? (default 10)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getLowStock(req, res, next) {
  try {
    const pool = getPool();
    const threshold = parseInt(req.query.threshold) || 10;

    const result = await pool
      .request()
      .input('threshold', sql.Int, threshold)
      .query(`
        SELECT inv.ingredient_id, ing.name AS ingredient_name, inv.quantity,
               s.name AS supplier_name, s.phone AS supplier_phone
        FROM Inventory inv
        JOIN Ingredient ing ON inv.ingredient_id = ing.ingredient_id
        JOIN Supplier   s   ON ing.supplier_id   = s.supplier_id
        WHERE inv.quantity <= @threshold
        ORDER BY inv.quantity ASC
      `);

    res.json({ success: true, threshold, low_stock: result.recordset });
  } catch (err) {
    next(err);
  }
}

module.exports = { getInventory, updateInventoryQuantity, getLowStock };
