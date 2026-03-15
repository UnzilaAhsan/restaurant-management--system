/**
 * @file utils/logger.js
 * @description Centralised Winston logger.
 *
 * Outputs:
 *  - Console: colourised, human-readable (development)
 *  - logs/combined.log: all levels
 *  - logs/error.log: errors only
 *  - logs/transactions.log: all rollback / transaction events (for Phase 2 evidence)
 */

'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = process.env.LOG_DIR || './logs';
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const { combine, timestamp, printf, colorize, errors } = format;

const logFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    let line = `${ts} [${level.toUpperCase()}] ${message}`;
    if (Object.keys(meta).length) line += ` | ${JSON.stringify(meta)}`;
    if (stack) line += `\n${stack}`;
    return line;
});

const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), logFormat),
    transports: [
        new transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
        new transports.File({ filename: path.join(logDir, 'combined.log') }),
        new transports.File({ filename: path.join(logDir, 'transactions.log'), level: 'warn' }),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(
        new transports.Console({
            format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), errors({ stack: true }), logFormat),
        })
    );
}

/**
 * Log a transaction ROLLBACK event. Writes to transactions.log (warn level)
 * so that the media/ evidence file captures every rollback with full context.
 *
 * @param {string} scenario - Descriptive name, e.g. 'CREATE_ORDER'
 * @param {Error|string} reason - The error or reason for rollback
 * @param {object} [meta] - Optional extra context (order_id, table_id, etc.)
 */
logger.logRollback = (scenario, reason, meta = {}) => {
    logger.warn(`ROLLBACK [${scenario}]: ${reason?.message || reason}`, {
        scenario,
        stack: reason?.stack,
        ...meta,
    });
};

/**
 * Log a COMMIT event.
 *
 * @param {string} scenario
 * @param {object} [meta]
 */
logger.logCommit = (scenario, meta = {}) => {
    logger.info(`COMMIT [${scenario}]`, { scenario, ...meta });
};

module.exports = logger;
