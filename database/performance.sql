USE RestaurantDB;
GO


PRINT 'Query 1: Orders after 2026-01-01 (Before Index)';
SET STATISTICS IO ON;
SET STATISTICS TIME ON;

SELECT * 
FROM [Order]
WHERE order_time > '2026-01-01';
GO


CREATE INDEX idx_order_time_perf ON [Order](order_time);
GO

PRINT 'Query 1: Orders after 2026-01-01 (After Index)';
SELECT * 
FROM [Order]
WHERE order_time > '2026-01-01';
GO



PRINT 'Query 2: Search MenuDish by Name (Before Index)';
SELECT * 
FROM MenuDish
WHERE dish_name LIKE 'C%';
GO


CREATE INDEX idx_dish_name_perf ON MenuDish(dish_name);
GO

PRINT 'Query 2: Search MenuDish by Name (After Index)';
SELECT * 
FROM MenuDish
WHERE dish_name LIKE 'C%';
GO


PRINT 'Query 3: Customer Lookup by Phone (Before Index)';
SELECT * 
FROM Customer
WHERE phone = '03010000001';
GO


CREATE INDEX idx_customer_phone_perf ON Customer(phone);
GO

PRINT 'Query 3: Customer Lookup by Phone (After Index)';
SELECT * 
FROM Customer
WHERE phone = '03010000001';
GO


PRINT 'Query 4: Order Summary Join Performance';
SELECT o.order_id, c.name, SUM(oi.quantity * d.price) AS total_amount
FROM [Order] o
JOIN Customer c ON o.customer_id = c.customer_id
JOIN OrderItem oi ON o.order_id = oi.order_id
JOIN MenuDish d ON oi.dish_id = d.dish_id
GROUP BY o.order_id, c.name;
GO
