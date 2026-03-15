/**
 * @file routes/shiftRoutes.js
 */
'use strict';
const router = require('express').Router();
const { createShift, getShifts } = require('../controllers/shiftController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireAdminLevel } = require('../middleware/roleMiddleware');
const { validate, schemas } = require('../middleware/validationMiddleware');

router.use(authenticate);
router.use(requireAdminLevel(null)); // any admin level

router.get('/', getShifts);
router.post('/', validate(schemas.createShift), createShift);

module.exports = router;
