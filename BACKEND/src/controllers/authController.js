/**
 * @file controllers/authController.js
 * @description Authentication endpoints for Admin login/registration.
 *
 * The Admin table stores system-level accounts (Super / Normal).
 * Employee role-based access is determined by the Role table (Chef=1, Waiter=2, Cashier=3).
 *
 * Login accepts both Admin and Employee credentials via separate endpoints.
 */

'use strict';

const { getPool, sql } = require('../config/database');
const { generateToken } = require('../utils/jwtUtils');
const { hashPassword, comparePassword } = require('../utils/hashUtils');
const { createError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

/**
 * POST /api/v1/auth/login
 * Authenticates an Admin user. Returns a signed JWT on success.
 *
 * Request body: { username: string, password: string }
 * Response 200: { success: true, token: string, user: { admin_id, username, access_level } }
 * Response 401: Invalid credentials
 *
 * SQL: SELECT admin_id, username, password, access_level FROM Admin WHERE username = @username
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function loginAdmin(req, res, next) {
  try {
    const { username, password } = req.body;
    const pool = getPool();

    // Parameterised query prevents SQL injection
    const result = await pool
      .request()
      .input('username', sql.NVarChar(50), username)
      .query('SELECT admin_id, username, password, access_level FROM Admin WHERE username = @username');

    const admin = result.recordset[0];
    if (!admin) return next(createError(401, 'Invalid username or password'));

    const valid = await comparePassword(password, admin.password);
    if (!valid) return next(createError(401, 'Invalid username or password'));

    const token = generateToken({
      id: admin.admin_id,
      username: admin.username,
      type: 'admin',
      access_level: admin.access_level,
    });

    logger.info(`Admin login: ${username}`, { admin_id: admin.admin_id });

    res.json({
      success: true,
      token,
      user: { admin_id: admin.admin_id, username: admin.username, access_level: admin.access_level },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/employee/login
 * Authenticates an Employee by name + password stored in a separate credentials table.
 *
 * NOTE: The provided schema stores employees without passwords (employees log in via name lookup).
 * This implementation searches Employee by name and returns a role-scoped token.
 * For a real system, add an employee_credentials table.
 *
 * Request body: { username: string, password: string }
 * Response 200: { success: true, token: string, user: { employee_id, name, role, role_id } }
 * Response 401: Employee not found
 *
 * SQL: SELECT e.employee_id, e.name, r.role_name, r.role_id
 *      FROM Employee e JOIN Role r ON e.role_id = r.role_id
 *      WHERE e.name = @name
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function loginEmployee(req, res, next) {
  try {
    const { username } = req.body; // 'username' maps to employee name here
    const pool = getPool();

    const result = await pool
      .request()
      .input('name', sql.NVarChar(100), username)
      .query(`
        SELECT e.employee_id, e.name, r.role_name, r.role_id, e.branch_id
        FROM Employee e
        JOIN Role r ON e.role_id = r.role_id
        WHERE e.name = @name
      `);

    const employee = result.recordset[0];
    if (!employee) return next(createError(401, 'Employee not found'));

    const token = generateToken({
      id: employee.employee_id,
      username: employee.name,
      type: 'employee',
      role: employee.role_name,
      role_id: employee.role_id,
      branch_id: employee.branch_id,
    });

    logger.info(`Employee login: ${username}`, { employee_id: employee.employee_id, role: employee.role_name });

    res.json({
      success: true,
      token,
      user: {
        employee_id: employee.employee_id,
        name: employee.name,
        role: employee.role_name,
        role_id: employee.role_id,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/register
 * Creates a new Admin account. Restricted to Super admins only.
 *
 * Request body: { username: string, password: string, access_level: 'Super'|'Normal' }
 * Response 201: { success: true, admin_id: number }
 * Response 403: Non-Super admin attempted registration
 * Response 409: Username already exists (UNIQUE constraint)
 *
 * SQL: INSERT INTO Admin (username, password, access_level) VALUES (@username, @hash, @access_level)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function registerAdmin(req, res, next) {
  try {
    const { username, password, access_level } = req.body;
    const pool = getPool();

    // Check for duplicate username before attempting insert
    const existing = await pool
      .request()
      .input('username', sql.NVarChar(50), username)
      .query('SELECT admin_id FROM Admin WHERE username = @username');

    if (existing.recordset.length > 0) {
      return next(createError(409, `Username '${username}' is already taken`));
    }

    const hash = await hashPassword(password);

    const insertResult = await pool
      .request()
      .input('username', sql.NVarChar(50), username)
      .input('password', sql.NVarChar(255), hash)
      .input('access_level', sql.NVarChar(20), access_level)
      .query(`
        INSERT INTO Admin (username, password, access_level)
        OUTPUT INSERTED.admin_id
        VALUES (@username, @password, @access_level)
      `);

    const admin_id = insertResult.recordset[0].admin_id;
    logger.info(`New admin registered: ${username}`, { admin_id, created_by: req.user.username });

    res.status(201).json({ success: true, admin_id });
  } catch (err) {
    next(err);
  }
}

module.exports = { loginAdmin, loginEmployee, registerAdmin };
