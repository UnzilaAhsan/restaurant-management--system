/**
 * @file routes/reservationRoutes.js
 * @description Reservation and table management routes.
 */
'use strict';
const router = require('express').Router();
const { createReservation, getReservations, updateTableStatus, getTables } = require('../controllers/reservationController');
const { authenticate } = require('../middleware/authMiddleware');
const { validate, schemas } = require('../middleware/validationMiddleware');

router.use(authenticate);

// Reservations
router.get('/reservations', getReservations);
router.post('/reservations', validate(schemas.createReservation), createReservation);

// Tables
router.get('/tables', getTables);
router.put('/tables/:id/status', validate(schemas.updateTableStatus), updateTableStatus);

module.exports = router;
