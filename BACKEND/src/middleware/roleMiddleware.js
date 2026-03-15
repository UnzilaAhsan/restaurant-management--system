/**
 * @file middleware/roleMiddleware.js
 * @description Role-Based Access Control (RBAC) middleware.
 *
 * The system has two separate identity types:
 *   1. Admin   – rows in the Admin table (access_level: 'Super' | 'Normal')
 *   2. Employee – rows in Employee table with a Role (Chef=1, Waiter=2, Cashier=3)
 *
 * JWT payload shape set by authController:
 *   { id, username, type: 'admin'|'employee', role_id?, role?, access_level? }
 *
 * Usage in routes:
 *   router.post('/orders', authenticate, requireRole('waiter'), createOrder);
 *   router.post('/register', authenticate, requireAdminLevel('Super'), registerAdmin);
 */

'use strict';

const { createError } = require('../utils/errorHandler');

/** Role name → role_id mapping from seed data */
const ROLE_IDS = { chef: 1, waiter: 2, cashier: 3 };

/**
 * Middleware factory: require the authenticated user to be an employee
 * with one of the specified role names (case-insensitive).
 *
 * @param {...string} roles - Allowed role names e.g. 'waiter', 'chef'
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.post('/orders', authenticate, requireRole('waiter'), createOrder);
 */
function requireRole(...roles) {
  const allowed = roles.map((r) => r.toLowerCase());
  return (req, res, next) => {
    const user = req.user;
    if (!user) return next(createError(401, 'Not authenticated'));

    // Admins have no employee role – deny unless explicitly listed
    if (user.type === 'admin') {
      if (allowed.includes('admin')) return next();
      return next(createError(403, `Access restricted to roles: ${roles.join(', ')}`));
    }

    const userRole = (user.role || '').toLowerCase();
    if (!allowed.includes(userRole)) {
      return next(createError(403, `Access restricted to roles: ${roles.join(', ')}`));
    }
    next();
  };
}

/**
 * Middleware factory: require the authenticated user to be an Admin
 * with the specified access_level.
 *
 * @param {'Super'|'Normal'|null} level - Required access_level, or null for any admin
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.post('/auth/register', authenticate, requireAdminLevel('Super'), registerAdmin);
 */
function requireAdminLevel(level = null) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return next(createError(401, 'Not authenticated'));
    if (user.type !== 'admin') return next(createError(403, 'Admin access required'));
    if (level && user.access_level !== level) {
      return next(createError(403, `Requires ${level} admin access`));
    }
    next();
  };
}

/**
 * Middleware: allow any authenticated user (admin or employee).
 * Convenience alias; actual authentication is handled by authMiddleware.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requireAnyRole(req, res, next) {
  if (!req.user) return next(createError(401, 'Not authenticated'));
  next();
}

module.exports = { requireRole, requireAdminLevel, requireAnyRole, ROLE_IDS };
