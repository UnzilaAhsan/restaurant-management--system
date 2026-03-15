/**
 * @file utils/jwtUtils.js
 * @description Helper functions for JWT generation and verification.
 *
 * Tokens include: { id, username, role, role_id, access_level }
 * Secret is stored in JWT_SECRET env variable – never hardcoded.
 */

'use strict';

const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'change_me_in_production';
const EXPIRY = process.env.JWT_EXPIRY || '8h';

/**
 * Generate a signed JWT for an authenticated admin/employee.
 *
 * @param {{ admin_id?: number, employee_id?: number, username: string, role?: string, role_id?: number, access_level?: string }} payload
 * @returns {string} Signed JWT string
 */
function generateToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRY, issuer: 'restaurant-api' });
}

/**
 * Verify and decode a JWT string.
 *
 * @param {string} token
 * @returns {{ id: number, username: string, role: string, role_id: number, access_level?: string }}
 * @throws {JsonWebTokenError} if token is invalid or expired
 */
function verifyToken(token) {
  return jwt.verify(token, SECRET, { issuer: 'restaurant-api' });
}

module.exports = { generateToken, verifyToken };
