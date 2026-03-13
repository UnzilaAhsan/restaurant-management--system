'use strict';

const sql = require('mssql');
const logger = require('../utils/logger');

let pool = null;

const config = {
  server: 'localhost\\SQLEXPRESS',
  database: process.env.DB_NAME || 'master',

  options: {
    encrypt: false,
    trustServerCertificate: true
  },

  authentication: {
    type: 'default',
    options: {
      userName: process.env.DB_USER || 'sa',
      password: process.env.DB_PASSWORD || ''
    }
  }
};

// connect to database
async function connectDB() {
  try {
    pool = await sql.connect(config);
    logger.info('Connected to SQL Server successfully.');
    return pool;
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

// get active pool
function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call connectDB first.');
  }
  return pool;
}

// close pool
async function closeDB() {
  if (pool) {
    await pool.close();
    pool = null;
    logger.info('SQL Server connection closed.');
  }
}

module.exports = {
  connectDB,
  getPool,
  closeDB
};