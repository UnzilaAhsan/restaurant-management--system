/**
 * @file controllers/shiftController.js
 * @description Employee shift assignment endpoints.
 *
 * TRANSACTION SCENARIO 3: Assign shift with overlap detection.
 * -----------------------------------------------------------------
 * BEGIN TRANSACTION
 *   Verify employee exists in Employee table
 *   SELECT overlapping shifts: WHERE employee_id = @eid
 *     AND NOT (end_time <= @start OR start_time >= @end)
 *   IF overlap found → THROW 409 (ROLLBACK triggered)
 *   INSERT INTO Shift (employee_id, start_time, end_time)
 * COMMIT
 * -----------------------------------------------------------------
 *
 * Roles: Super Admin or Normal Admin (shift management is admin-level).
 */

'use strict';

const { getPool, getTransaction, sql } = require('../config/database');
const { createError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

/**
 * POST /api/v1/shifts
 * Assigns a shift to an employee, checking for scheduling conflicts.
 *
 * @route POST /api/v1/shifts
 * @access Admin (any level)
 *
 * Request body: { employee_id, start_time (ISO), end_time (ISO) }
 *
 * Response 201: { success: true, shift_id }
 * Response 404: Employee not found
 * Response 409: Overlapping shift exists
 *
 * Overlap condition:
 *   Existing shift overlaps if NOT (existing.end_time <= new.start OR existing.start_time >= new.end)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function createShift(req, res, next) {
    const { employee_id, start_time, end_time } = req.body;
    const transaction = await getTransaction();

    try {
        await transaction.begin();
        logger.info('BEGIN TRANSACTION [CREATE_SHIFT]', { employee_id, start_time, end_time });

        // Verify employee exists
        const empCheck = await new sql.Request(transaction)
            .input('eid', sql.Int, employee_id)
            .query('SELECT employee_id, name FROM Employee WHERE employee_id = @eid');
        if (empCheck.recordset.length === 0) {
            throw createError(404, `Employee ${employee_id} not found`);
        }

        // Check for overlapping shifts using the standard interval overlap formula.
        // Two intervals [A,B] and [C,D] overlap when NOT (B <= C OR A >= D).
        const overlapCheck = await new sql.Request(transaction)
            .input('employee_id', sql.Int, employee_id)
            .input('start_time', sql.DateTime2, new Date(start_time))
            .input('end_time', sql.DateTime2, new Date(end_time))
            .query(`
        SELECT shift_id, start_time, end_time
        FROM Shift
        WHERE employee_id = @employee_id
          AND NOT (end_time <= @start_time OR start_time >= @end_time)
      `);

        if (overlapCheck.recordset.length > 0) {
            const conflict = overlapCheck.recordset[0];
            throw createError(409, `Shift conflicts with existing shift (ID: ${conflict.shift_id}, ${conflict.start_time} – ${conflict.end_time})`);
        }

        // INSERT new shift
        const shiftResult = await new sql.Request(transaction)
            .input('employee_id', sql.Int, employee_id)
            .input('start_time', sql.DateTime2, new Date(start_time))
            .input('end_time', sql.DateTime2, new Date(end_time))
            .query(`
        INSERT INTO Shift (employee_id, start_time, end_time)
        OUTPUT INSERTED.shift_id
        VALUES (@employee_id, @start_time, @end_time)
      `);

        const shift_id = shiftResult.recordset[0].shift_id;

        await transaction.commit();
        logger.logCommit('CREATE_SHIFT', { shift_id, employee_id });

        res.status(201).json({ success: true, shift_id, employee_id });
    } catch (err) {
        try { await transaction.rollback(); } catch (_) { }
        logger.logRollback('CREATE_SHIFT', err, { employee_id, start_time, end_time });
        next(err.statusCode ? err : createError(500, `Shift creation failed: ${err.message}`));
    }
}

/**
 * GET /api/v1/shifts
 * Returns all shifts with employee and role information.
 *
 * @route GET /api/v1/shifts
 * @access Admin
 *
 * Query params: employee_id? – filter by employee
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getShifts(req, res, next) {
    try {
        const pool = getPool();
        const { employee_id } = req.query;
        const request = pool.request();
        let where = '';

        if (employee_id) {
            where = 'WHERE s.employee_id = @employee_id';
            request.input('employee_id', sql.Int, parseInt(employee_id));
        }

        const result = await request.query(`
      SELECT s.shift_id, s.start_time, s.end_time,
             e.employee_id, e.name AS employee_name,
             r.role_name, b.name AS branch_name
      FROM Shift s
      JOIN Employee e ON s.employee_id = e.employee_id
      JOIN Role r     ON e.role_id     = r.role_id
      JOIN Branch b   ON e.branch_id   = b.branch_id
      ${where}
      ORDER BY s.start_time DESC
    `);

        res.json({ success: true, shifts: result.recordset });
    } catch (err) {
        next(err);
    }
}

module.exports = { createShift, getShifts };
