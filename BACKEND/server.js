'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const sql = require('mssql');
const logger = require('./src/utils/logger');
const { errorHandler } = require('./src/utils/errorHandler');

const authRoutes        = require('./src/routes/authRoutes');
const orderRoutes       = require('./src/routes/orderRoutes');
const paymentRoutes     = require('./src/routes/paymentRoutes');
const reservationRoutes = require('./src/routes/reservationRoutes');
const inventoryRoutes   = require('./src/routes/inventoryRoutes');
const menuRoutes        = require('./src/routes/menuRoutes');
const customerRoutes    = require('./src/routes/customerRoutes');
const shiftRoutes       = require('./src/routes/shiftRoutes');
const reportRoutes      = require('./src/routes/reportRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use(
  morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } })
);

// ── Health check ──────────────────────────────────────────────────
app.get('/api/v1/health', async (req, res) => {
  try {
    const pool = await sql.connect(global.dbConfig);
    await pool.request().query('SELECT 1 AS ping');
    res.json({ status: 'ok', db: 'connected', uptime: process.uptime(), timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected', message: err.message });
  }
});

app.use('/api/v1/auth',        authRoutes);
app.use('/api/v1/orders',      orderRoutes);
app.use('/api/v1/payments',    paymentRoutes);
app.use('/api/v1',             reservationRoutes);
app.use('/api/v1/inventory',   inventoryRoutes);
app.use('/api/v1/menu',        menuRoutes);
app.use('/api/v1/customers',   customerRoutes);
app.use('/api/v1/shifts',      shiftRoutes);
app.use('/api/v1/reports',     reportRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.originalUrl} not found` });
});

app.use(errorHandler);

async function start() {
  try {
    logger.info('Connecting to SQL Server...');

    const dbConfig = {
      user: 'sa',
      password: 'ums123',           // sa password
      server: '127.0.0.1',          // Use port
      database: 'RestaurantDB', 
      options: {
        encrypt: false,
        trustServerCertificate: true
      },
      port: 1433
    };

    // ── Connect to SQL Server
    await sql.connect(dbConfig);
    logger.info('Database connected successfully.');
    global.dbConfig = dbConfig; // store globally for health check reuse

    // ── Start server
    const server = app.listen(PORT, () => {
      logger.info(`Restaurant API running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/api/v1/health`);
    });

    const shutdown = async (signal) => {
      logger.info(`${signal} received – shutting down gracefully`);
      server.close(async () => {
        await sql.close();
        logger.info('Database connection closed. Goodbye.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

  } catch (err) {
    logger.error('Fatal startup error:', err);
    process.exit(1);
  }
}

start();

module.exports = app;
