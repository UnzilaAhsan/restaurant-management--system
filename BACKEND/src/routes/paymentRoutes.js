/**
 * @file routes/paymentRoutes.js
 * @description Payment endpoints – Cashier role required for creation.
 */
'use strict';
const router = require('express').Router();
const { createPayment, getPayments, getPaymentById } = require('../controllers/paymentController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { validate, schemas } = require('../middleware/validationMiddleware');

router.use(authenticate);

router.get('/', getPayments);
router.get('/:id', getPaymentById);
router.post('/', requireRole('cashier'), validate(schemas.createPayment), createPayment);

module.exports = router;
