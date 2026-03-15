/**
 * @file routes/reportRoutes.js
 */
'use strict';
const router = require('express').Router();
const { getSalesReport, getPopularDishes, getInventoryUsage } = require('../controllers/reportController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireAdminLevel } = require('../middleware/roleMiddleware');

router.use(authenticate);
router.use(requireAdminLevel(null)); // any admin

router.get('/sales', getSalesReport);
router.get('/popular-dishes', getPopularDishes);
router.get('/inventory-usage', getInventoryUsage);

module.exports = router;
