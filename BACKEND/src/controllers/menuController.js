/**
 * @file controllers/menuController.js
 * @description Menu, category and dish endpoints.
 *
 * All endpoints are read-only GET operations accessible to any authenticated user.
 * Joins Menu → MenuCategory → MenuDish for hierarchical data.
 */

'use strict';

const { getPool, sql } = require('../config/database');
const { createError } = require('../utils/errorHandler');

/**
 * GET /api/v1/menu
 * Returns all menus with nested categories and dishes per branch.
 *
 * @route GET /api/v1/menu
 * @access Any authenticated user
 *
 * SQL:
 *   SELECT m.menu_id, m.menu_name, b.name AS branch_name,
 *          mc.category_id, mc.category_name,
 *          md.dish_id, md.dish_name, md.price
 *   FROM Menu m
 *   JOIN Branch b ON m.branch_id = b.branch_id
 *   LEFT JOIN MenuCategory mc ON mc.menu_id = m.menu_id
 *   LEFT JOIN MenuDish md ON md.category_id = mc.category_id
 *   ORDER BY m.menu_id, mc.category_id, md.dish_id
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getFullMenu(req, res, next) {
    try {
        const pool = getPool();
        const result = await pool.request().query(`
      SELECT
        m.menu_id, m.menu_name,
        b.branch_id, b.name AS branch_name,
        mc.category_id, mc.category_name,
        md.dish_id, md.dish_name, md.price
      FROM Menu m
      JOIN Branch b ON m.branch_id = b.branch_id
      LEFT JOIN MenuCategory mc ON mc.menu_id = m.menu_id
      LEFT JOIN MenuDish md     ON md.category_id = mc.category_id
      ORDER BY m.menu_id, mc.category_id, md.dish_id
    `);

        // Group flat rows into nested structure: menu > categories > dishes
        const menuMap = {};
        for (const row of result.recordset) {
            if (!menuMap[row.menu_id]) {
                menuMap[row.menu_id] = {
                    menu_id: row.menu_id,
                    menu_name: row.menu_name,
                    branch: { branch_id: row.branch_id, name: row.branch_name },
                    categories: {},
                };
            }
            if (row.category_id) {
                if (!menuMap[row.menu_id].categories[row.category_id]) {
                    menuMap[row.menu_id].categories[row.category_id] = {
                        category_id: row.category_id,
                        category_name: row.category_name,
                        dishes: [],
                    };
                }
                if (row.dish_id) {
                    menuMap[row.menu_id].categories[row.category_id].dishes.push({
                        dish_id: row.dish_id,
                        dish_name: row.dish_name,
                        price: parseFloat(row.price),
                    });
                }
            }
        }

        // Convert maps to arrays for JSON output
        const menus = Object.values(menuMap).map((m) => ({
            ...m,
            categories: Object.values(m.categories),
        }));

        res.json({ success: true, menus });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/v1/dishes
 * Returns all dishes with category and price information.
 *
 * @route GET /api/v1/dishes
 * @access Any authenticated user
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getDishes(req, res, next) {
    try {
        const pool = getPool();
        const result = await pool.request().query(`
      SELECT
        md.dish_id, md.dish_name, md.price,
        mc.category_id, mc.category_name,
        m.menu_id, m.menu_name
      FROM MenuDish md
      JOIN MenuCategory mc ON md.category_id = mc.category_id
      JOIN Menu m           ON mc.menu_id     = m.menu_id
      ORDER BY mc.category_name, md.dish_name
    `);

        res.json({ success: true, count: result.recordset.length, dishes: result.recordset });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/v1/dishes/:id
 * Returns a single dish with full ingredient list.
 *
 * @route GET /api/v1/dishes/:id
 * @access Any authenticated user
 *
 * SQL:
 *   SELECT md.*, mc.category_name FROM MenuDish md JOIN MenuCategory mc ...
 *   SELECT mdi.ingredient_id, ing.name FROM MenuDishIngredient mdi JOIN Ingredient ing ...
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getDishById(req, res, next) {
    try {
        const pool = getPool();
        const dish_id = parseInt(req.params.id);

        const dishResult = await pool
            .request()
            .input('dish_id', sql.Int, dish_id)
            .query(`
        SELECT md.dish_id, md.dish_name, md.price,
               mc.category_id, mc.category_name,
               m.menu_id, m.menu_name
        FROM MenuDish md
        JOIN MenuCategory mc ON md.category_id = mc.category_id
        JOIN Menu m           ON mc.menu_id     = m.menu_id
        WHERE md.dish_id = @dish_id
      `);

        if (dishResult.recordset.length === 0) {
            return next(createError(404, `Dish ${dish_id} not found`));
        }

        const ingredientsResult = await pool
            .request()
            .input('dish_id', sql.Int, dish_id)
            .query(`
        SELECT mdi.ingredient_id, ing.name AS ingredient_name,
               s.name AS supplier_name
        FROM MenuDishIngredient mdi
        JOIN Ingredient ing ON mdi.ingredient_id = ing.ingredient_id
        JOIN Supplier s     ON ing.supplier_id   = s.supplier_id
        WHERE mdi.dish_id = @dish_id
      `);

        const dish = dishResult.recordset[0];
        dish.ingredients = ingredientsResult.recordset;

        res.json({ success: true, dish });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/v1/categories
 * Returns all menu categories with their parent menu.
 *
 * @route GET /api/v1/categories
 * @access Any authenticated user
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getCategories(req, res, next) {
    try {
        const pool = getPool();
        const result = await pool.request().query(`
      SELECT mc.category_id, mc.category_name, mc.menu_id, m.menu_name
      FROM MenuCategory mc
      JOIN Menu m ON mc.menu_id = m.menu_id
      ORDER BY m.menu_name, mc.category_name
    `);
        res.json({ success: true, categories: result.recordset });
    } catch (err) {
        next(err);
    }
}

module.exports = { getFullMenu, getDishes, getDishById, getCategories };
