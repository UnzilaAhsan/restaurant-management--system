/**
 * @file controllers/customerController.js
 * @description Customer CRUD endpoints with order history.
 *
 * Enforces UNIQUE constraints on phone and email via pre-check before insert.
 * Supports pagination and search for the GET /customers endpoint.
 */

'use strict';

const { getPool, sql } = require('../config/database');
const { createError } = require('../utils/errorHandler');

/**
 * GET /api/v1/customers
 * Returns paginated customer list with optional search.
 *
 * @route GET /api/v1/customers
 * @access Any authenticated user
 *
 * Query params:
 *   page?   (default 1)
 *   limit?  (default 20)
 *   search? – matches name, phone, or email (LIKE %search%)
 *
 * SQL: SELECT ... FROM Customer WHERE name LIKE @s OR phone LIKE @s OR email LIKE @s
 *      ORDER BY customer_id OFFSET ... ROWS FETCH NEXT ... ROWS ONLY
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getCustomers(req, res, next) {
  try {
    const pool = getPool();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : null;

    const request = pool.request();
    request.input('offset', sql.Int, offset);
    request.input('limit', sql.Int, limit);

    let whereClause = '';
    if (search) {
      whereClause = 'WHERE c.name LIKE @search OR c.phone LIKE @search OR c.email LIKE @search';
      request.input('search', sql.NVarChar(200), search);
    }

    const result = await request.query(`
      SELECT c.customer_id, c.name, c.phone, c.email, c.created_at
      FROM Customer c
      ${whereClause}
      ORDER BY c.customer_id
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    // Get total count for pagination metadata
    const countRequest = pool.request();
    if (search) countRequest.input('search', sql.NVarChar(200), search);
    const countResult = await countRequest.query(`
      SELECT COUNT(*) AS total FROM Customer c ${whereClause}
    `);

    const total = countResult.recordset[0].total;

    res.json({
      success: true,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      customers: result.recordset,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/customers
 * Creates a new customer record.
 *
 * @route POST /api/v1/customers
 * @access Any authenticated user
 *
 * Request body: { name, phone?, email? }
 *
 * Response 201: { success: true, customer_id }
 * Response 409: Phone or email already exists
 *
 * SQL: INSERT INTO Customer (name, phone, email) OUTPUT INSERTED.customer_id VALUES (...)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function createCustomer(req, res, next) {
  try {
    const pool = getPool();
    const { name, phone, email } = req.body;

    // Pre-check UNIQUE constraints to give friendly error messages
    if (phone) {
      const phoneCheck = await pool
        .request()
        .input('phone', sql.NVarChar(15), phone)
        .query('SELECT customer_id FROM Customer WHERE phone = @phone');
      if (phoneCheck.recordset.length > 0) {
        return next(createError(409, `Phone number '${phone}' is already registered`));
      }
    }
    if (email) {
      const emailCheck = await pool
        .request()
        .input('email', sql.NVarChar(100), email)
        .query('SELECT customer_id FROM Customer WHERE email = @email');
      if (emailCheck.recordset.length > 0) {
        return next(createError(409, `Email '${email}' is already registered`));
      }
    }

    const insertResult = await pool
      .request()
      .input('name', sql.NVarChar(100), name)
      .input('phone', sql.NVarChar(15), phone || null)
      .input('email', sql.NVarChar(100), email || null)
      .query(`
        INSERT INTO Customer (name, phone, email)
        OUTPUT INSERTED.customer_id
        VALUES (@name, @phone, @email)
      `);

    const customer_id = insertResult.recordset[0].customer_id;
    res.status(201).json({ success: true, customer_id });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/customers/:id
 * Returns a customer with their order history.
 *
 * @route GET /api/v1/customers/:id
 * @access Any authenticated user
 *
 * SQL: SELECT * FROM Customer WHERE customer_id = @id
 *      + SELECT o.order_id, o.order_time, p.amount, p.method FROM [Order] o LEFT JOIN Payment p...
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getCustomerById(req, res, next) {
  try {
    const pool = getPool();
    const customer_id = parseInt(req.params.id);

    const customerResult = await pool
      .request()
      .input('customer_id', sql.Int, customer_id)
      .query('SELECT customer_id, name, phone, email, created_at FROM Customer WHERE customer_id = @customer_id');

    if (customerResult.recordset.length === 0) {
      return next(createError(404, `Customer ${customer_id} not found`));
    }

    const ordersResult = await pool
      .request()
      .input('customer_id', sql.Int, customer_id)
      .query(`
        SELECT o.order_id, o.order_time,
               p.payment_id, p.amount, p.method
        FROM [Order] o
        LEFT JOIN Payment p ON o.order_id = p.order_id
        WHERE o.customer_id = @customer_id
        ORDER BY o.order_time DESC
      `);

    const customer = customerResult.recordset[0];
    customer.orders = ordersResult.recordset;

    res.json({ success: true, customer });
  } catch (err) {
    next(err);
  }
}

module.exports = { getCustomers, createCustomer, getCustomerById };
