/**
 * @file routes/customerRoutes.js
 */
'use strict';
const router = require('express').Router();
const { getCustomers, createCustomer, getCustomerById } = require('../controllers/customerController');
const { authenticate } = require('../middleware/authMiddleware');
const { validate, schemas } = require('../middleware/validationMiddleware');

router.use(authenticate);

router.get('/', getCustomers);
router.post('/', validate(schemas.createCustomer), createCustomer);
router.get('/:id', getCustomerById);

module.exports = router;
