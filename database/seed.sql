USE RestaurantDB;
GO

INSERT INTO Role VALUES ('Chef'),('Waiter'),('Cashier');
GO

INSERT INTO Admin VALUES
('admin','admin123','Super'),
('system','sys123','Normal');
GO

INSERT INTO Branch VALUES
('Central Branch','Lahore DHA'),
('Islamabad Branch','F-10 Islamabad'),
('Karachi Branch','Clifton Karachi');
GO

INSERT INTO Manager VALUES
('Ali Khan',120000,1),
('Sara Ahmed',110000,2),
('Hamza Raza',115000,3);
GO

INSERT INTO Employee VALUES
('Usman',50000,1,1),
('Ayesha',45000,2,1),
('Bilal',40000,3,1),
('Noor',47000,2,2),
('Zain',52000,1,3);
GO

INSERT INTO Shift VALUES
(1,'2026-02-20 09:00','2026-02-20 17:00'),
(2,'2026-02-20 12:00','2026-02-20 20:00');
GO

INSERT INTO Customer VALUES
('Ahmed Raza','03010000001','a1@gmail.com',DEFAULT),
('Fatima Noor','03010000002','a2@gmail.com',DEFAULT),
('Hassan Ali','03010000003','a3@gmail.com',DEFAULT),
('Aiman Khan','03010000004','a4@gmail.com',DEFAULT),
('Bilal Sheikh','03010000005','a5@gmail.com',DEFAULT);
GO

INSERT INTO DiningTable VALUES
(4,'Available',1),
(6,'Available',1),
(2,'Available',2),
(8,'Available',3);
GO

INSERT INTO Menu VALUES
('Main Menu',1),
('Main Menu',2),
('Main Menu',3);
GO

INSERT INTO MenuCategory VALUES
('Fast Food',1),
('Drinks',1),
('Desserts',1);
GO

INSERT INTO MenuDish VALUES
('Chicken Burger',450,1),
('Beef Burger',550,1),
('Pizza',1200,1),
('Cola',150,2),
('Ice Cream',300,3);
GO

INSERT INTO Supplier VALUES
('Fresh Farms','03001111111'),
('Ocean Foods','03002222222'),
('Meat Masters','03003333333');
GO

INSERT INTO Ingredient VALUES
('Chicken',3),
('Beef',3),
('Cheese',1),
('Tomato',1),
('Flour',1);
GO

INSERT INTO Inventory VALUES
(1,200),(2,150),(3,80),(4,300),(5,500);
GO

INSERT INTO MenuDishIngredient VALUES
(1,1),(1,3),(1,4),
(2,2),(2,3),(2,4),
(3,5),(3,3);
GO

INSERT INTO [Order] (customer_id,employee_id) VALUES
(1,2),(2,3),(3,2),(4,1),(5,2);
GO

INSERT INTO OrderItem VALUES
(1,1,2),
(1,4,1),
(2,2,1),
(3,3,1),
(4,5,2);
GO

INSERT INTO Payment VALUES
(1,1050,'Cash'),
(2,550,'Card'),
(3,1200,'Online'),
(4,600,'Cash'),
(5,900,'Card');
GO

INSERT INTO Reservation VALUES
(1,1,'2026-02-25 19:00'),
(2,2,'2026-02-25 20:00');
GO

INSERT INTO Feedback VALUES
(1,5,'Excellent'),
(2,4,'Very Good'),
(3,3,'Average');
GO
