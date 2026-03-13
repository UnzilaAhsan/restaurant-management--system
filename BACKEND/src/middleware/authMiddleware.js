/**
 * @file middleware/authMiddleware.js
 * @description JWT authentication middleware.
 *
 * Extracts the Bearer token from the Authorization header,
 * verifies it using the JWT_SECRET, and attaches the decoded
 * payload as req.user for downstream middleware/controllers.
 *
 * Expected header format:
 *   Authorization: Bearer <token>
 *
 * Responds 401 if token is missing, malformed, or expired.
 */

'use strict';

const { verifyToken } = require('../utils/jwtUtils');
const { createError } = require('../utils/errorHandler');

/**
 * Express middleware that enforces JWT authentication.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return next(createError(401, 'Authentication token required'));
    }

    const token = authHeader.slice(7); // strip "Bearer "
    const decoded = verifyToken(token);
    req.user = decoded; // attach payload: { id, username, role, role_id, access_level }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(createError(401, 'Token has expired'));
    }
    return next(createError(401, 'Invalid or malformed token'));
  }
}

module.exports = { authenticate };
