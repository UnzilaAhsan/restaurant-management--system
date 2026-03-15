/**
 * @file controllers/reservationController.js
 * @description Reservation and DiningTable endpoints.
 *
 * TRANSACTION SCENARIO 2: Table Reservation with concurrency protection.
 * -----------------------------------------------------------------
 * BEGIN TRANSACTION (READ COMMITTED with row lock)
 *   SELECT status FROM DiningTable WITH (UPDLOCK, ROWLOCK) WHERE table_id = @id
 *   IF status != 'Available' → THROW 409 (ROLLBACK triggered)
 *   INSERT INTO Reservation (customer_id, table_id, reservation_time)
 *   UPDATE DiningTable SET status = 'Reserved' WHERE table_id = @id
 * COMMIT
 * -----------------------------------------------------------------
 *
 * The UPDLOCK hint acquired in the SELECT prevents two concurrent requests
 * from both reading 'Available' before either has committed the UPDATE,
 * thereby eliminating the double-booking race condition.
 *
 * Roles: All authenticated users.
 */

'use strict';

const { getPool, getTransaction, sql } = require('../config/database');
const { createError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

/**
 * POST /api/v1/reservations
 * Creates a reservation and marks the table as Reserved atomically.
 *
 * @route POST /api/v1/reservations
 * @access Any authenticated user
 *
 * Request body: { customer_id, table_id, reservation_time (ISO) }
 *
 * Response 201: { success: true, reservation_id }
 * Response 409: Table not available
 * Response 404: Customer or table not found
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function createReservation(req, res, next) {
    const { customer_id, table_id, reservation_time } = req.body;
    const transaction = await getTransaction();

    try {
        await transaction.begin();
        logger.info('BEGIN TRANSACTION [CREATE_RESERVATION]', { customer_id, table_id });

        // Verify customer exists
        const custCheck = await new sql.Request(transaction)
            .input('cid', sql.Int, customer_id)
            .query('SELECT customer_id FROM Customer WHERE customer_id = @cid');
        if (custCheck.recordset.length === 0) {
            throw createError(404, `Customer ${customer_id} not found`);
        }

        // Lock the table row (UPDLOCK) to prevent concurrent reservations.
        // No other transaction can acquire a write lock on this row until we commit/rollback.
        const tableResult = await new sql.Request(transaction)
            .input('table_id', sql.Int, table_id)
            .query(`
        SELECT table_id, status, capacity
        FROM DiningTable WITH (UPDLOCK, ROWLOCK)
        WHERE table_id = @table_id
      `);

        if (tableResult.recordset.length === 0) {
            throw createError(404, `Table ${table_id} not found`);
        }

        const table = tableResult.recordset[0];
        if (table.status !== 'Available') {
            throw createError(409, `Table ${table_id} is currently '${table.status}' and cannot be reserved`);
        }

        // INSERT reservation
        const reservationResult = await new sql.Request(transaction)
            .input('customer_id', sql.Int, customer_id)
            .input('table_id', sql.Int, table_id)
            .input('reservation_time', sql.DateTime2, new Date(reservation_time))
            .query(`
        INSERT INTO Reservation (customer_id, table_id, reservation_time)
        OUTPUT INSERTED.reservation_id
        VALUES (@customer_id, @table_id, @reservation_time)
      `);

        const reservation_id = reservationResult.recordset[0].reservation_id;

        // UPDATE table status to Reserved
        await new sql.Request(transaction)
            .input('table_id', sql.Int, table_id)
            .query(`UPDATE DiningTable SET status = 'Reserved' WHERE table_id = @table_id`);

        await transaction.commit();
        logger.logCommit('CREATE_RESERVATION', { reservation_id, customer_id, table_id });

        res.status(201).json({ success: true, reservation_id, table_id, customer_id });
    } catch (err) {
        try { await transaction.rollback(); } catch (_) { }
        logger.logRollback('CREATE_RESERVATION', err, { customer_id, table_id });
        next(err.statusCode ? err : createError(500, `Reservation failed: ${err.message}`));
    }
}

/**
 * GET /api/v1/reservations
 * Returns all reservations with customer and table details.
 *
 * @route GET /api/v1/reservations
 * @access Any authenticated user
 *
 * SQL: SELECT r.*, c.name, dt.capacity, dt.status
 *      FROM Reservation r JOIN Customer c JOIN DiningTable dt
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getReservations(req, res, next) {
    try {
        const pool = getPool();
        const result = await pool.request().query(`
      SELECT r.reservation_id, r.reservation_time,
             r.customer_id, c.name AS customer_name, c.phone AS customer_phone,
             r.table_id, dt.capacity, dt.status AS table_status
      FROM Reservation r
      JOIN Customer c ON r.customer_id = c.customer_id
      JOIN DiningTable dt ON r.table_id = dt.table_id
      ORDER BY r.reservation_time DESC
    `);

        res.json({ success: true, count: result.recordset.length, reservations: result.recordset });
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/v1/tables/:id/status
 * Updates a dining table's status (Available, Occupied, or Reserved).
 *
 * @route PUT /api/v1/tables/:id/status
 * @access Any authenticated user
 *
 * Request body: { status: 'Available'|'Occupied'|'Reserved' }
 *
 * SQL: UPDATE DiningTable SET status = @status WHERE table_id = @id
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function updateTableStatus(req, res, next) {
    try {
        const pool = getPool();
        const table_id = parseInt(req.params.id);
        const { status } = req.body;

        const check = await pool
            .request()
            .input('table_id', sql.Int, table_id)
            .query('SELECT table_id FROM DiningTable WHERE table_id = @table_id');

        if (check.recordset.length === 0) {
            return next(createError(404, `Table ${table_id} not found`));
        }

        await pool
            .request()
            .input('status', sql.NVarChar(20), status)
            .input('table_id', sql.Int, table_id)
            .query('UPDATE DiningTable SET status = @status WHERE table_id = @table_id');

        logger.info(`Table ${table_id} status updated to ${status}`);
        res.json({ success: true, table_id, status });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/v1/tables
 * Returns all dining tables with status and branch info.
 *
 * @route GET /api/v1/tables
 * @access Any authenticated user
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getTables(req, res, next) {
    try {
        const pool = getPool();
        const result = await pool.request().query(`
      SELECT dt.table_id, dt.capacity, dt.status, dt.branch_id, b.name AS branch_name
      FROM DiningTable dt
      JOIN Branch b ON dt.branch_id = b.branch_id
      ORDER BY dt.branch_id, dt.table_id
    `);
        res.json({ success: true, tables: result.recordset });
    } catch (err) {
        next(err);
    }
}

module.exports = { createReservation, getReservations, updateTableStatus, getTables };
