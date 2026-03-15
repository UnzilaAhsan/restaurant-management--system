CREATE DATABASE RestaurantDB;
GO
USE RestaurantDB;
GO

-- ================= SYSTEM =================

CREATE TABLE Admin (
    admin_id INT IDENTITY PRIMARY KEY,
    username NVARCHAR(50) UNIQUE NOT NULL,
    password NVARCHAR(255) NOT NULL,
    access_level NVARCHAR(20) CHECK (access_level IN ('Super','Normal'))
);
GO

CREATE TABLE Role (
    role_id INT IDENTITY PRIMARY KEY,
    role_name NVARCHAR(50) UNIQUE NOT NULL
);
GO

CREATE TABLE Branch (
    branch_id INT IDENTITY PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    location NVARCHAR(200) NOT NULL
);
GO

CREATE TABLE Manager (
    manager_id INT IDENTITY PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    salary DECIMAL(10,2) CHECK (salary > 0),
    branch_id INT NOT NULL,
    FOREIGN KEY (branch_id) REFERENCES Branch(branch_id)
);
GO

CREATE TABLE Employee (
    employee_id INT IDENTITY PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    salary DECIMAL(10,2) CHECK (salary > 0),
    role_id INT NOT NULL,
    branch_id INT NOT NULL,
    FOREIGN KEY (role_id) REFERENCES Role(role_id),
    FOREIGN KEY (branch_id) REFERENCES Branch(branch_id)
);
GO

CREATE TABLE Shift (
    shift_id INT IDENTITY PRIMARY KEY,
    employee_id INT NOT NULL,
    start_time DATETIME2 NOT NULL,
    end_time DATETIME2 NOT NULL,
    FOREIGN KEY (employee_id) REFERENCES Employee(employee_id)
);
GO

-- ================= CUSTOMER =================

CREATE TABLE Customer (
    customer_id INT IDENTITY PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    phone NVARCHAR(15) UNIQUE,
    email NVARCHAR(100) UNIQUE,
    created_at DATETIME2 DEFAULT SYSDATETIME()
);
GO

CREATE TABLE Feedback (
    feedback_id INT IDENTITY PRIMARY KEY,
    customer_id INT NOT NULL,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    comment NVARCHAR(300),
    FOREIGN KEY (customer_id) REFERENCES Customer(customer_id)
);
GO

-- ================= DINING & RESERVATION =================

CREATE TABLE DiningTable (
    table_id INT IDENTITY PRIMARY KEY,
    capacity INT CHECK (capacity > 0),
    status NVARCHAR(20) CHECK (status IN ('Available','Occupied','Reserved')),
    branch_id INT NOT NULL,
    FOREIGN KEY (branch_id) REFERENCES Branch(branch_id)
);
GO

CREATE TABLE Reservation (
    reservation_id INT IDENTITY PRIMARY KEY,
    customer_id INT NOT NULL,
    table_id INT NOT NULL,
    reservation_time DATETIME2 NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES Customer(customer_id),
    FOREIGN KEY (table_id) REFERENCES DiningTable(table_id)
);
GO

-- ================= MENU SYSTEM =================

CREATE TABLE Menu (
    menu_id INT IDENTITY PRIMARY KEY,
    menu_name NVARCHAR(100) NOT NULL,
    branch_id INT NOT NULL,
    FOREIGN KEY (branch_id) REFERENCES Branch(branch_id)
);
GO

CREATE TABLE MenuCategory (
    category_id INT IDENTITY PRIMARY KEY,
    category_name NVARCHAR(100) NOT NULL,
    menu_id INT NOT NULL,
    FOREIGN KEY (menu_id) REFERENCES Menu(menu_id)
);
GO

CREATE TABLE MenuDish (
    dish_id INT IDENTITY PRIMARY KEY,
    dish_name NVARCHAR(100) NOT NULL,
    price DECIMAL(10,2) CHECK (price > 0),
    category_id INT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES MenuCategory(category_id)
);
GO

-- ================= INVENTORY =================

CREATE TABLE Supplier (
    supplier_id INT IDENTITY PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    phone NVARCHAR(15) UNIQUE
);
GO

CREATE TABLE Ingredient (
    ingredient_id INT IDENTITY PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    supplier_id INT NOT NULL,
    FOREIGN KEY (supplier_id) REFERENCES Supplier(supplier_id)
);
GO

CREATE TABLE Inventory (
    inventory_id INT IDENTITY PRIMARY KEY,
    ingredient_id INT UNIQUE NOT NULL,
    quantity INT CHECK (quantity >= 0),
    FOREIGN KEY (ingredient_id) REFERENCES Ingredient(ingredient_id)
);
GO

CREATE TABLE MenuDishIngredient (
    dish_id INT NOT NULL,
    ingredient_id INT NOT NULL,
    PRIMARY KEY (dish_id, ingredient_id),
    FOREIGN KEY (dish_id) REFERENCES MenuDish(dish_id),
    FOREIGN KEY (ingredient_id) REFERENCES Ingredient(ingredient_id)
);
GO

-- ================= ORDERS =================

CREATE TABLE [Order] (
    order_id INT IDENTITY PRIMARY KEY,
    order_time DATETIME2 DEFAULT SYSDATETIME(),
    customer_id INT NOT NULL,
    employee_id INT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES Customer(customer_id),
    FOREIGN KEY (employee_id) REFERENCES Employee(employee_id)
);
GO

CREATE TABLE OrderItem (
    order_item_id INT IDENTITY PRIMARY KEY,
    order_id INT NOT NULL,
    dish_id INT NOT NULL,
    quantity INT CHECK (quantity > 0),
    FOREIGN KEY (order_id) REFERENCES [Order](order_id),
    FOREIGN KEY (dish_id) REFERENCES MenuDish(dish_id)
);
GO

CREATE TABLE Payment (
    payment_id INT IDENTITY PRIMARY KEY,
    order_id INT UNIQUE NOT NULL,
    amount DECIMAL(10,2) CHECK (amount > 0),
    method NVARCHAR(20) CHECK (method IN ('Cash','Card','Online')),
    FOREIGN KEY (order_id) REFERENCES [Order](order_id)
);
GO

-- ================= INDEXES =================

CREATE INDEX idx_order_time ON [Order](order_time);
CREATE INDEX idx_customer_phone ON Customer(phone);
CREATE INDEX idx_dish_name ON MenuDish(dish_name);
GO
