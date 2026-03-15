/**
 * @file routes/authRoutes.js
 * @description Authentication routes – public (no auth required).
 */
'use strict';
const router = require('express').Router();
const { loginAdmin, loginEmployee, registerAdmin } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireAdminLevel } = require('../middleware/roleMiddleware');
const { validate, schemas } = require('../middleware/validationMiddleware');

// POST /api/v1/auth/login          – admin login
router.post('/login', validate(schemas.login), loginAdmin);

// POST /api/v1/auth/employee/login – employee login (no password in schema, uses name lookup)
router.post('/employee/login', validate(schemas.login), loginEmployee);

// POST /api/v1/auth/register       – create new admin (Super admin only)
router.post(
    '/register',
    authenticate,
    requireAdminLevel('Super'),
    validate(schemas.registerAdmin),
    registerAdmin
);

module.exports = router;
