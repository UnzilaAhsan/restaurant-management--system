/**
 * @file controllers/reportController.js
 * @description Reporting endpoints for sales analytics, popular dishes, and inventory usage.
 *
 * All reports use raw SQL aggregation queries.
 * Access is restricted to Admin users only.
 */

'use strict';

const { getPool, sql } = require('../config/database');
const { createError } = require('../utils/errorHandler');

/**
 * GET /api/v1/reports/sales
 * Returns total sales, order count, and payment method breakdown for a date range.
 *
 * @route GET /api/v1/reports/sales
 * @access Admin
 *
 * Query params: start (ISO date), end (ISO date)
 *
 * SQL:
 *   SELECT COUNT(o.order_id) AS total_orders,
 *          SUM(p.amount)     AS total_revenue,
 *          p.method,         COUNT(*) AS method_count
 *   FROM [Order] o
 *   JOIN Payment p ON o.order_id = p.order_id
 *   WHERE o.order_time BETWEEN @start AND @end
 *   GROUP BY p.method
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getSalesReport(req, res, next) {
  try {
    const pool = getPool();
    const { start, end } = req.query;

    if (!start || !end) {
      return next(createError(400, 'Query params "start" and "end" (ISO dates) are required'));
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    // Set end to end-of-day
    endDate.setHours(23, 59, 59, 999);

    // Overall totals
    const totalsResult = await pool
      .request()
      .input('start', sql.DateTime2, startDate)
      .input('end', sql.DateTime2, endDate)
      .query(`
        SELECT
          COUNT(DISTINCT o.order_id) AS total_orders,
          ISNULL(SUM(p.amount), 0)   AS total_revenue
        FROM [Order] o
        LEFT JOIN Payment p ON o.order_id = p.order_id
        WHERE o.order_time BETWEEN @start AND @end
      `);

    // Breakdown by payment method
    const methodResult = await pool
      .request()
      .input('start', sql.DateTime2, startDate)
      .input('end', sql.DateTime2, endDate)
      .query(`
        SELECT p.method,
               COUNT(*)        AS transaction_count,
               SUM(p.amount)   AS method_revenue
        FROM [Order] o
        JOIN Payment p ON o.order_id = p.order_id
        WHERE o.order_time BETWEEN @start AND @end
        GROUP BY p.method
        ORDER BY method_revenue DESC
      `);

    res.json({
      success: true,
      period: { start, end },
      summary: totalsResult.recordset[0],
      by_method: methodResult.recordset,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/reports/popular-dishes
 * Returns the most ordered dishes ranked by total quantity sold.
 *
 * @route GET /api/v1/reports/popular-dishes
 * @access Admin
 *
 * SQL:
 *   SELECT d.dish_id, d.dish_name, d.price,
 *          SUM(oi.quantity) AS total_ordered
 *   FROM OrderItem oi
 *   JOIN MenuDish d ON oi.dish_id = d.dish_id
 *   GROUP BY d.dish_id, d.dish_name, d.price
 *   ORDER BY total_ordered DESC
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getPopularDishes(req, res, next) {
  try {
    const pool = getPool();
    const topN = Math.min(50, parseInt(req.query.top) || 10);

    const result = await pool
      .request()
      .input('topN', sql.Int, topN)
      .query(`
        SELECT TOP (@topN)
          d.dish_id,
          d.dish_name,
          d.price,
          mc.category_name,
          SUM(oi.quantity)              AS total_ordered,
          SUM(oi.quantity * d.price)    AS total_revenue
        FROM OrderItem oi
        JOIN MenuDish     d  ON oi.dish_id    = d.dish_id
        JOIN MenuCategory mc ON d.category_id = mc.category_id
        GROUP BY d.dish_id, d.dish_name, d.price, mc.category_name
        ORDER BY total_ordered DESC
      `);

    res.json({ success: true, top: topN, dishes: result.recordset });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/reports/inventory-usage
 * Estimates ingredient consumption based on processed orders.
 * Uses MenuDishIngredient to calculate how much of each ingredient
 * has been used across all OrderItems.
 *
 * @route GET /api/v1/reports/inventory-usage
 * @access Admin
 *
 * SQL:
 *   SELECT ing.name, SUM(oi.quantity) AS estimated_units_used,
 *          inv.quantity               AS current_stock
 *   FROM OrderItem oi
 *   JOIN MenuDishIngredient mdi ON oi.dish_id     = mdi.dish_id
 *   JOIN Ingredient         ing ON mdi.ingredient_id = ing.ingredient_id
 *   JOIN Inventory          inv ON ing.ingredient_id = inv.ingredient_id
 *   GROUP BY ing.ingredient_id, ing.name, inv.quantity
 *   ORDER BY estimated_units_used DESC
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getInventoryUsage(req, res, next) {
  try {
    const pool = getPool();

    const result = await pool.request().query(`
      SELECT
        ing.ingredient_id,
        ing.name           AS ingredient_name,
        s.name             AS supplier_name,
        SUM(oi.quantity)   AS estimated_units_used,
        inv.quantity       AS current_stock
      FROM OrderItem oi
      JOIN MenuDishIngredient mdi ON oi.dish_id        = mdi.dish_id
      JOIN Ingredient         ing ON mdi.ingredient_id = ing.ingredient_id
      JOIN Inventory          inv ON ing.ingredient_id = inv.ingredient_id
      JOIN Supplier           s   ON ing.supplier_id   = s.supplier_id
      GROUP BY ing.ingredient_id, ing.name, s.name, inv.quantity
      ORDER BY estimated_units_used DESC
    `);

    res.json({ success: true, usage: result.recordset });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSalesReport, getPopularDishes, getInventoryUsage };
