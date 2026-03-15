/**
 * @file validators/schemas.js
 * @description Consolidated Joi validation schemas for every API endpoint.
 *
 * These are imported by validationMiddleware.js and used via the validate() factory.
 * Keeping schemas here (separate from middleware) makes them independently testable.
 *
 * Validation strategy:
 *  - abortEarly: false  → collect ALL field errors before returning 400
 *  - stripUnknown: true → silently drop unexpected fields (prevents mass-assignment)
 *  - convert: true      → Joi coerces types (e.g. string "3" → number 3 for query params)
 */

'use strict';

const Joi = require('joi');

// ─── AUTH ─────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/login
 * POST /api/v1/auth/employee/login
 */
const login = Joi.object({
    username: Joi.string().max(50).required().messages({
        'string.empty': 'username is required',
        'string.max': 'username must not exceed 50 characters',
    }),
    password: Joi.string().min(1).required().messages({
        'string.empty': 'password is required',
    }),
});

/**
 * POST /api/v1/auth/register
 * Super-admin only — creates a new Admin account.
 */
const registerAdmin = Joi.object({
    username: Joi.string().max(50).required(),
    password: Joi.string().min(8).required().messages({
        'string.min': 'password must be at least 8 characters',
    }),
    access_level: Joi.string().valid('Super', 'Normal').required().messages({
        'any.only': 'access_level must be "Super" or "Normal"',
    }),
});

// ─── ORDERS ───────────────────────────────────────────────────────

/**
 * POST /api/v1/orders
 * Waiter creates an order with one or more items.
 */
const createOrder = Joi.object({
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
        .required()
        .messages({ 'array.min': 'At least one item is required' }),
});

// ─── PAYMENTS ─────────────────────────────────────────────────────

/**
 * POST /api/v1/payments
 * Cashier creates a payment for an existing order.
 * Amount is NOT accepted from the client (calculated server-side).
 */
const createPayment = Joi.object({
    order_id: Joi.number().integer().positive().required(),
    method: Joi.string().valid('Cash', 'Card', 'Online').required().messages({
        'any.only': 'method must be Cash, Card, or Online',
    }),
});

// ─── RESERVATIONS ─────────────────────────────────────────────────

/**
 * POST /api/v1/reservations
 */
const createReservation = Joi.object({
    customer_id: Joi.number().integer().positive().required(),
    table_id: Joi.number().integer().positive().required(),
    reservation_time: Joi.date().iso().required().messages({
        'date.format': 'reservation_time must be an ISO 8601 date string',
    }),
});

/**
 * PUT /api/v1/tables/:id/status
 */
const updateTableStatus = Joi.object({
    status: Joi.string().valid('Available', 'Occupied', 'Reserved').required().messages({
        'any.only': 'status must be Available, Occupied, or Reserved',
    }),
});

// ─── INVENTORY ────────────────────────────────────────────────────

/**
 * PUT /api/v1/inventory/:ingredient_id
 */
const updateInventory = Joi.object({
    quantity: Joi.number().integer().min(0).required().messages({
        'number.min': 'quantity cannot be negative',
    }),
});

// ─── CUSTOMERS ────────────────────────────────────────────────────

/**
 * POST /api/v1/customers
 */
const createCustomer = Joi.object({
    name: Joi.string().max(100).required(),
    phone: Joi.string().max(15).pattern(/^[0-9+\-() ]+$/).optional().allow('', null).messages({
        'string.pattern.base': 'phone must contain only digits, +, -, (, ) or spaces',
    }),
    email: Joi.string().email().max(100).optional().allow('', null),
});

// ─── SHIFTS ───────────────────────────────────────────────────────

/**
 * POST /api/v1/shifts
 * Admin assigns a shift to an employee.
 */
const createShift = Joi.object({
    employee_id: Joi.number().integer().positive().required(),
    start_time: Joi.date().iso().required(),
    end_time: Joi.date().iso().greater(Joi.ref('start_time')).required().messages({
        'date.greater': 'end_time must be after start_time',
    }),
});

// ─── QUERY PARAM SCHEMAS ──────────────────────────────────────────

/**
 * GET /api/v1/reports/sales
 */
const salesReport = Joi.object({
    start: Joi.date().iso().required(),
    end: Joi.date().iso().min(Joi.ref('start')).required().messages({
        'date.min': '"end" must be on or after "start"',
    }),
});

/**
 * GET /api/v1/customers  (pagination + search)
 */
const customerList = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().max(100).optional().allow(''),
});

module.exports = {
    login,
    registerAdmin,
    createOrder,
    createPayment,
    createReservation,
    updateTableStatus,
    updateInventory,
    createCustomer,
    createShift,
    salesReport,
    customerList,
};
