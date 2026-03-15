/**
 * @file routes/menuRoutes.js
 */
'use strict';
const router = require('express').Router();
const { getFullMenu, getDishes, getDishById, getCategories } = require('../controllers/menuController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', getFullMenu);
router.get('/dishes', getDishes);
router.get('/dishes/:id', getDishById);
router.get('/categories', getCategories);

module.exports = router;
