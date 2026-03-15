/**
 * @file routes/orderRoutes.js
 * @description Order endpoints – Waiter role required for mutations.
 */
'use strict';
const router = require('express').Router();
const { createOrder, getOrders, getOrderById, processInventory } = require('../controllers/orderController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { validate, schemas } = require('../middleware/validationMiddleware');

// All routes require authentication
router.use(authenticate);

// GET  /api/v1/orders       – any auth
router.get('/', getOrders);

// GET  /api/v1/orders/:id   – any auth
router.get('/:id', getOrderById);

// POST /api/v1/orders       – Waiter only
router.post('/', requireRole('waiter'), validate(schemas.createOrder), createOrder);

// POST /api/v1/orders/:id/process-inventory – Chef only
router.post('/:id/process-inventory', requireRole('chef'), processInventory);

module.exports = router;
