/**
 * @file models/queries.js
 * @description Centralised raw SQL query functions.
 *
 * Each function receives a sql.Request (or transaction-bound request)
 * and returns a typed result. Controllers import these instead of
 * inlining query strings, keeping controllers thin and queries testable.
 *
 * All queries use parameterised inputs — never string concatenation.
 */

'use strict';

const { sql } = require('../config/database');

// ─────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────

/**
 * Find an Admin row by username.
 * @param {import('mssql').Request} req
 * @param {string} username
 */
async function findAdminByUsername(req, username) {
    req.input('username', sql.NVarChar(50), username);
    const result = await req.query(
        'SELECT admin_id, username, password, access_level FROM Admin WHERE username = @username'
    );
    return result.recordset[0] || null;
}

/**
 * Insert a new Admin. Returns the new admin_id.
 * @param {import('mssql').Request} req
 * @param {{ username: string, passwordHash: string, access_level: string }} data
 */
async function insertAdmin(req, { username, passwordHash, access_level }) {
    req.input('username', sql.NVarChar(50), username);
    req.input('password', sql.NVarChar(255), passwordHash);
    req.input('access_level', sql.NVarChar(20), access_level);
    const result = await req.query(`
    INSERT INTO Admin (username, password, access_level)
    OUTPUT INSERTED.admin_id
    VALUES (@username, @password, @access_level)
  `);
    return result.recordset[0].admin_id;
}

// ─────────────────────────────────────────────
// EMPLOYEE
// ─────────────────────────────────────────────

/**
 * Find an Employee with their Role by name.
 * @param {import('mssql').Request} req
 * @param {string} name
 */
async function findEmployeeByName(req, name) {
    req.input('name', sql.NVarChar(100), name);
    const result = await req.query(`
    SELECT e.employee_id, e.name, e.branch_id,
           r.role_id, r.role_name
    FROM Employee e
    JOIN Role r ON e.role_id = r.role_id
    WHERE e.name = @name
  `);
    return result.recordset[0] || null;
}

/**
 * Check employee exists by ID.
 * @param {import('mssql').Request} req
 * @param {number} employee_id
 */
async function findEmployeeById(req, employee_id) {
    req.input('employee_id', sql.Int, employee_id);
    const result = await req.query(
        'SELECT employee_id, name FROM Employee WHERE employee_id = @employee_id'
    );
    return result.recordset[0] || null;
}

// ─────────────────────────────────────────────
// CUSTOMER
// ─────────────────────────────────────────────

/**
 * Check customer exists by ID.
 * @param {import('mssql').Request} req
 * @param {number} customer_id
 */
async function findCustomerById(req, customer_id) {
    req.input('customer_id', sql.Int, customer_id);
    const result = await req.query(
        'SELECT customer_id, name, phone, email FROM Customer WHERE customer_id = @customer_id'
    );
    return result.recordset[0] || null;
}

/**
 * Insert a new Customer. Returns new customer_id.
 * @param {import('mssql').Request} req
 * @param {{ name: string, phone?: string, email?: string }} data
 */
async function insertCustomer(req, { name, phone, email }) {
    req.input('name', sql.NVarChar(100), name);
    req.input('phone', sql.NVarChar(15), phone || null);
    req.input('email', sql.NVarChar(100), email || null);
    const result = await req.query(`
    INSERT INTO Customer (name, phone, email)
    OUTPUT INSERTED.customer_id
    VALUES (@name, @phone, @email)
  `);
    return result.recordset[0].customer_id;
}

// ─────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────

/**
 * Insert an Order header. Returns new order_id.
 * @param {import('mssql').Request} req
 * @param {{ customer_id: number, employee_id: number }} data
 */
async function insertOrder(req, { customer_id, employee_id }) {
    req.input('customer_id', sql.Int, customer_id);
    req.input('employee_id', sql.Int, employee_id);
    const result = await req.query(`
    INSERT INTO [Order] (order_time, customer_id, employee_id)
    OUTPUT INSERTED.order_id
    VALUES (SYSDATETIME(), @customer_id, @employee_id)
  `);
    return result.recordset[0].order_id;
}

/**
 * Insert one OrderItem row.
 * @param {import('mssql').Request} req
 * @param {{ order_id: number, dish_id: number, quantity: number }} data
 */
async function insertOrderItem(req, { order_id, dish_id, quantity }) {
    req.input('order_id', sql.Int, order_id);
    req.input('dish_id', sql.Int, dish_id);
    req.input('quantity', sql.Int, quantity);
    await req.query(`
    INSERT INTO OrderItem (order_id, dish_id, quantity)
    VALUES (@order_id, @dish_id, @quantity)
  `);
}

/**
 * Find a Dish by ID.
 * @param {import('mssql').Request} req
 * @param {number} dish_id
 */
async function findDishById(req, dish_id) {
    req.input('dish_id', sql.Int, dish_id);
    const result = await req.query(
        'SELECT dish_id, dish_name, price FROM MenuDish WHERE dish_id = @dish_id'
    );
    return result.recordset[0] || null;
}

// ─────────────────────────────────────────────
// PAYMENT
// ─────────────────────────────────────────────

/**
 * Calculate the total amount for an order from OrderItems × dish prices.
 * @param {import('mssql').Request} req
 * @param {number} order_id
 * @returns {Promise<number>}
 */
async function calculateOrderTotal(req, order_id) {
    req.input('order_id', sql.Int, order_id);
    const result = await req.query(`
    SELECT ISNULL(SUM(oi.quantity * d.price), 0) AS total
    FROM OrderItem oi
    JOIN MenuDish d ON oi.dish_id = d.dish_id
    WHERE oi.order_id = @order_id
  `);
    return parseFloat(result.recordset[0].total);
}

/**
 * Insert a Payment. Returns new payment_id.
 * @param {import('mssql').Request} req
 * @param {{ order_id: number, amount: number, method: string }} data
 */
async function insertPayment(req, { order_id, amount, method }) {
    req.input('order_id', sql.Int, order_id);
    req.input('amount', sql.Decimal(10, 2), amount);
    req.input('method', sql.NVarChar(20), method);
    const result = await req.query(`
    INSERT INTO Payment (order_id, amount, method)
    OUTPUT INSERTED.payment_id
    VALUES (@order_id, @amount, @method)
  `);
    return result.recordset[0].payment_id;
}

// ─────────────────────────────────────────────
// DINING TABLE
// ─────────────────────────────────────────────

/**
 * Find a DiningTable by ID with an UPDLOCK to prevent concurrent reservation.
 * Must be called within an active transaction.
 * @param {import('mssql').Request} req  (transaction-bound)
 * @param {number} table_id
 */
async function findTableWithLock(req, table_id) {
    req.input('table_id', sql.Int, table_id);
    const result = await req.query(`
    SELECT table_id, capacity, status, branch_id
    FROM DiningTable WITH (UPDLOCK, ROWLOCK)
    WHERE table_id = @table_id
  `);
    return result.recordset[0] || null;
}

/**
 * Update the status of a DiningTable.
 * @param {import('mssql').Request} req
 * @param {number} table_id
 * @param {'Available'|'Occupied'|'Reserved'} status
 */
async function updateTableStatus(req, table_id, status) {
    req.input('table_id', sql.Int, table_id);
    req.input('status', sql.NVarChar(20), status);
    await req.query('UPDATE DiningTable SET status = @status WHERE table_id = @table_id');
}

// ─────────────────────────────────────────────
// RESERVATION
// ─────────────────────────────────────────────

/**
 * Insert a Reservation. Returns new reservation_id.
 * @param {import('mssql').Request} req
 * @param {{ customer_id: number, table_id: number, reservation_time: Date }} data
 */
async function insertReservation(req, { customer_id, table_id, reservation_time }) {
    req.input('customer_id', sql.Int, customer_id);
    req.input('table_id', sql.Int, table_id);
    req.input('reservation_time', sql.DateTime2, reservation_time);
    const result = await req.query(`
    INSERT INTO Reservation (customer_id, table_id, reservation_time)
    OUTPUT INSERTED.reservation_id
    VALUES (@customer_id, @table_id, @reservation_time)
  `);
    return result.recordset[0].reservation_id;
}

// ─────────────────────────────────────────────
// INVENTORY
// ─────────────────────────────────────────────

/**
 * Get inventory row for an ingredient with UPDLOCK.
 * Must be called within an active transaction.
 * @param {import('mssql').Request} req  (transaction-bound)
 * @param {number} ingredient_id
 */
async function findInventoryWithLock(req, ingredient_id) {
    req.input('ingredient_id', sql.Int, ingredient_id);
    const result = await req.query(`
    SELECT inventory_id, ingredient_id, quantity
    FROM Inventory WITH (UPDLOCK)
    WHERE ingredient_id = @ingredient_id
  `);
    return result.recordset[0] || null;
}

/**
 * Deduct quantity from an Inventory row.
 * @param {import('mssql').Request} req
 * @param {number} ingredient_id
 * @param {number} amount  Amount to deduct
 */
async function deductInventory(req, ingredient_id, amount) {
    req.input('ingredient_id', sql.Int, ingredient_id);
    req.input('amount', sql.Int, amount);
    await req.query(`
    UPDATE Inventory
    SET quantity = quantity - @amount
    WHERE ingredient_id = @ingredient_id
  `);
}

// ─────────────────────────────────────────────
// SHIFT
// ─────────────────────────────────────────────

/**
 * Find overlapping shifts for an employee.
 * Two intervals [A,B] and [C,D] overlap when NOT (B <= C OR A >= D).
 * @param {import('mssql').Request} req
 * @param {{ employee_id: number, start_time: Date, end_time: Date }} data
 */
async function findOverlappingShifts(req, { employee_id, start_time, end_time }) {
    req.input('employee_id', sql.Int, employee_id);
    req.input('start_time', sql.DateTime2, start_time);
    req.input('end_time', sql.DateTime2, end_time);
    const result = await req.query(`
    SELECT shift_id, start_time, end_time
    FROM Shift
    WHERE employee_id = @employee_id
      AND NOT (end_time <= @start_time OR start_time >= @end_time)
  `);
    return result.recordset;
}

/**
 * Insert a Shift. Returns new shift_id.
 * @param {import('mssql').Request} req
 * @param {{ employee_id: number, start_time: Date, end_time: Date }} data
 */
async function insertShift(req, { employee_id, start_time, end_time }) {
    req.input('employee_id', sql.Int, employee_id);
    req.input('start_time', sql.DateTime2, start_time);
    req.input('end_time', sql.DateTime2, end_time);
    const result = await req.query(`
    INSERT INTO Shift (employee_id, start_time, end_time)
    OUTPUT INSERTED.shift_id
    VALUES (@employee_id, @start_time, @end_time)
  `);
    return result.recordset[0].shift_id;
}

module.exports = {
    // Admin
    findAdminByUsername, insertAdmin,
    // Employee
    findEmployeeByName, findEmployeeById,
    // Customer
    findCustomerById, insertCustomer,
    // Orders
    insertOrder, insertOrderItem, findDishById,
    // Payment
    calculateOrderTotal, insertPayment,
    // Table
    findTableWithLock, updateTableStatus,
    // Reservation
    insertReservation,
    // Inventory
    findInventoryWithLock, deductInventory,
    // Shift
    findOverlappingShifts, insertShift,
};
