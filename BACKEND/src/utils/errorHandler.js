/**
 * @file utils/errorHandler.js
 * @description Centralised Express error-handling middleware.
 *
 * Must be registered as the LAST middleware in server.js.
 * Formats all thrown errors into a consistent JSON response.
 */

'use strict';

const logger = require('./logger');

/**
 * Express error handler. Called when next(err) is invoked anywhere.
 *
 * @param {Error & { statusCode?: number, errors?: any[] }} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
function errorHandler(err, req, res, _next) {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    logger.error(`${req.method} ${req.originalUrl} -> ${statusCode}: ${message}`, {
        stack: err.stack,
        body: req.body,
        params: req.params,
        query: req.query,
    });

    const body = {
        success: false,
        error: message,
        ...(err.errors && { details: err.errors }),
    };

    if (process.env.NODE_ENV !== 'production') {
        body.stack = err.stack;
    }

    res.status(statusCode).json(body);
}

/**
 * Factory to create a consistent HTTP error.
 *
 * @param {number} statusCode
 * @param {string} message
 * @param {any[]} [errors]
 * @returns {Error & { statusCode: number }}
 */
function createError(statusCode, message, errors) {
    const err = new Error(message);
    err.statusCode = statusCode;
    if (errors) err.errors = errors;
    return err;
}

module.exports = { errorHandler, createError };
