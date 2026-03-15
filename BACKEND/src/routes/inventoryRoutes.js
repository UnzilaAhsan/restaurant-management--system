/**
 * @file routes/inventoryRoutes.js
 */
'use strict';
const router = require('express').Router();
const { getInventory, updateInventoryQuantity, getLowStock } = require('../controllers/inventoryController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { validate, schemas } = require('../middleware/validationMiddleware');

router.use(authenticate);

router.get('/', getInventory);
router.get('/low-stock', getLowStock);
router.put('/:ingredient_id', requireRole('chef'), validate(schemas.updateInventory), updateInventoryQuantity);

module.exports = router;
