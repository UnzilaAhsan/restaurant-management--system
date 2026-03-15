/**
 * @file utils/hashUtils.js
 * @description bcrypt helpers for password hashing and comparison.
 *
 * Salt rounds are configured via BCRYPT_ROUNDS env variable (default 12).
 * Never store or log plaintext passwords.
 */

'use strict';

const bcrypt = require('bcrypt');

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

/**
 * Hash a plaintext password.
 *
 * @param {string} plaintext
 * @returns {Promise<string>} bcrypt hash
 */
async function hashPassword(plaintext) {
    return bcrypt.hash(plaintext, ROUNDS);
}

/**
 * Compare a plaintext password against a stored bcrypt hash.
 *
 * @param {string} plaintext
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function comparePassword(plaintext, hash) {
    return bcrypt.compare(plaintext, hash);
}

module.exports = { hashPassword, comparePassword };
