/**
 * @file middleware/validationMiddleware.js
 * @description Joi validation schemas and middleware factory.
 *
 * Usage:
 *   router.post('/login', validate(schemas.login), loginHandler);
 *
 * On validation failure responds 400 with an array of error messages.
 */

'use strict';

const Joi = require('joi');
const { createError } = require('../utils/errorHandler');

/**
 * Middleware factory: validates req.body against a Joi schema.
 *
 * @param {Joi.Schema} schema
 * @returns {import('express').RequestHandler}
 */
function validate(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
        if (error) {
            const messages = error.details.map((d) => d.message);
            return next(createError(400, 'Validation failed', messages));
        }
        req.body = value; // use sanitised/coerced value
        next();
    };
}

/**
 * Middleware factory: validates req.query against a Joi schema.
 *
 * @param {Joi.Schema} schema
 * @returns {import('express').RequestHandler}
 */
function validateQuery(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.query, { abortEarly: false, allowUnknown: false });
        if (error) {
            const messages = error.details.map((d) => d.message);
            return next(createError(400, 'Query validation failed', messages));
        }
        req.query = value;
        next();
    };
}

// ===================== Schemas =====================

const schemas = {
    // AUTH
    login: Joi.object({
        username: Joi.string().max(50).required(),
        password: Joi.string().min(6).required(),
    }),

    registerAdmin: Joi.object({
        username: Joi.string().max(50).required(),
        password: Joi.string().min(8).required(),
        access_level: Joi.string().valid('Super', 'Normal').required(),
    }),

    // ORDERS
    createOrder: Joi.object({
        customer_id: Joi.number().integer().positive().required(),
        employee_id: Joi.number().integer().positive().required(),
        items: Joi.array()
            .items(
                Joi.object({
                    dish_id: Joi.number().integer().positive().required(),
                    quantity: Joi.number().integer().min(1).required(),
                })
            )
            .min(1)
            .required(),
    }),

    // PAYMENT
    createPayment: Joi.object({
        order_id: Joi.number().integer().positive().required(),
        method: Joi.string().valid('Cash', 'Card', 'Online').required(),
    }),

    // RESERVATION
    createReservation: Joi.object({
        customer_id: Joi.number().integer().positive().required(),
        table_id: Joi.number().integer().positive().required(),
        reservation_time: Joi.date().iso().required(),
    }),

    updateTableStatus: Joi.object({
        status: Joi.string().valid('Available', 'Occupied', 'Reserved').required(),
    }),

    // INVENTORY
    updateInventory: Joi.object({
        quantity: Joi.number().integer().min(0).required(),
    }),

    // CUSTOMER
    createCustomer: Joi.object({
        name: Joi.string().max(100).required(),
        phone: Joi.string().max(15).optional().allow('', null),
        email: Joi.string().email().max(100).optional().allow('', null),
    }),

    // SHIFT
    createShift: Joi.object({
        employee_id: Joi.number().integer().positive().required(),
        start_time: Joi.date().iso().required(),
        end_time: Joi.date().iso().greater(Joi.ref('start_time')).required(),
    }),

    // REPORTS query params
    salesReport: Joi.object({
        start: Joi.date().iso().required(),
        end: Joi.date().iso().min(Joi.ref('start')).required(),
    }),
};

module.exports = { validate, validateQuery, schemas };
