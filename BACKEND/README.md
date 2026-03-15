# Restaurant Management System — Backend API

Phase 2 project for Advanced Database Management Course.  
A REST API built with Node.js + Express + SQL Server.

---

## Before You Start

Make sure you have these installed:
- Node.js (version 18 or higher)
- SQL Server (2019 or later, or Azure SQL)
- npm (comes with Node.js)

---

## Setup Instructions

### 1. Install dependencies

Open terminal in the backend folder and run:
```bash
npm install
```

### 2. Set up environment file

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` with your database credentials:
```env
DB_SERVER=localhost
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=YourPassword
DB_NAME=RestaurantDB
JWT_SECRET=put_a_long_random_string_here_min_32_chars
```

### 3. Create database and tables

Run the schema and seed files in SQL Server Management Studio or using sqlcmd:

```bash
sqlcmd -S localhost -U sa -P YourPassword -i schema_2.sql
sqlcmd -S localhost -U sa -P YourPassword -i seed_2.sql
```

### 4. Start the server

Development mode (auto-restart):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Expected output:
```
Server running on port 3000
Database connected successfully
```

---

## Verify API is Working

```bash
curl http://localhost:3000/api/v1/health
```

Response:
```json
{
  "status": "ok",
  "db": "connected",
  "uptime": 5.23,
  "timestamp": "2026-03-15T10:30:45.123Z"
}
```

---

## API Endpoints

All endpoints are prefixed with `/api/v1/`.

### Authentication

#### Admin Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"secret123"}'
```

#### Employee Login (no password per Phase 1)
```bash
curl -X POST http://localhost:3000/api/v1/auth/employee/login \
  -H "Content-Type: application/json" \
  -d '{"username":"Ali Hassan"}'
```

#### Register New Admin (Super Admin only)
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"username":"newadmin","password":"secure123","access_level":"Normal"}'
```

---

### Orders

#### Create Order (Waiter only)
```bash
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer <WAITER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "employee_id": 2,
    "items": [
      {"dish_id": 1, "quantity": 2},
      {"dish_id": 3, "quantity": 1}
    ]
  }'
```

#### Get All Orders
```bash
curl http://localhost:3000/api/v1/orders -H "Authorization: Bearer <TOKEN>"
curl "http://localhost:3000/api/v1/orders?customer_id=1&date=2026-03-15" -H "Authorization: Bearer <TOKEN>"
```

#### Get Order by ID
```bash
curl http://localhost:3000/api/v1/orders/1 -H "Authorization: Bearer <TOKEN>"
```

#### Process Inventory (Chef only)
```bash
curl -X POST http://localhost:3000/api/v1/orders/1/process-inventory \
  -H "Authorization: Bearer <CHEF_TOKEN>"
```

---

### Payments

#### Create Payment (Cashier only)
```bash
curl -X POST http://localhost:3000/api/v1/payments \
  -H "Authorization: Bearer <CASHIER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"order_id": 1, "method": "Card"}'
```
Methods allowed: Cash, Card, Online

#### List Payments
```bash
curl http://localhost:3000/api/v1/payments -H "Authorization: Bearer <TOKEN>"
curl "http://localhost:3000/api/v1/payments?method=Cash" -H "Authorization: Bearer <TOKEN>"
```

---

### Reservations

#### Create Reservation (UPDLOCK protects against double-booking)
```bash
curl -X POST http://localhost:3000/api/v1/reservations \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "table_id": 3,
    "reservation_time": "2026-03-20T19:00:00"
  }'
```

#### View Reservations
```bash
curl http://localhost:3000/api/v1/reservations -H "Authorization: Bearer <TOKEN>"
```

#### View Tables
```bash
curl http://localhost:3000/api/v1/tables -H "Authorization: Bearer <TOKEN>"
```

#### Update Table Status
```bash
curl -X PUT http://localhost:3000/api/v1/tables/3/status \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status": "Available"}'
```
Status options: Available, Reserved, Occupied

---

### Inventory

#### Get All Inventory
```bash
curl http://localhost:3000/api/v1/inventory -H "Authorization: Bearer <TOKEN>"
```

#### Check Low Stock
```bash
curl "http://localhost:3000/api/v1/inventory/low-stock?threshold=5" -H "Authorization: Bearer <TOKEN>"
```

#### Update Quantity (Chef only)
```bash
curl -X PUT http://localhost:3000/api/v1/inventory/1 \
  -H "Authorization: Bearer <CHEF_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 50}'
```

---

### Menu

#### Get Full Menu (hierarchical)
```bash
curl http://localhost:3000/api/v1/menu -H "Authorization: Bearer <TOKEN>"
```

#### List Dishes
```bash
curl http://localhost:3000/api/v1/menu/dishes -H "Authorization: Bearer <TOKEN>"
```

#### Get Dish with Ingredients
```bash
curl http://localhost:3000/api/v1/menu/dishes/1 -H "Authorization: Bearer <TOKEN>"
```

#### List Categories
```bash
curl http://localhost:3000/api/v1/menu/categories -H "Authorization: Bearer <TOKEN>"
```

---

### Customers

#### Create Customer
```bash
curl -X POST http://localhost:3000/api/v1/customers \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sara Ahmed",
    "phone": "03001234567",
    "email": "sara@example.com"
  }'
```

#### List Customers (paginated, searchable)
```bash
curl "http://localhost:3000/api/v1/customers?page=1&limit=10&search=Sara" -H "Authorization: Bearer <TOKEN>"
```

#### Get Customer with Order History
```bash
curl http://localhost:3000/api/v1/customers/1 -H "Authorization: Bearer <TOKEN>"
```

---

### Shifts (Admin only)

#### Create Shift (overlap protection)
```bash
curl -X POST http://localhost:3000/api/v1/shifts \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": 1,
    "start_time": "2026-03-15T08:00:00",
    "end_time": "2026-03-15T16:00:00"
  }'
```

#### View Shifts
```bash
curl "http://localhost:3000/api/v1/shifts?employee_id=1" -H "Authorization: Bearer <ADMIN_TOKEN>"
```

---

### Reports (Admin only)

#### Sales Report
```bash
curl "http://localhost:3000/api/v1/reports/sales?start=2026-01-01&end=2026-03-31" -H "Authorization: Bearer <ADMIN_TOKEN>"
```

#### Popular Dishes
```bash
curl "http://localhost:3000/api/v1/reports/popular-dishes?top=5" -H "Authorization: Bearer <ADMIN_TOKEN>"
```

#### Inventory Usage
```bash
curl http://localhost:3000/api/v1/reports/inventory-usage -H "Authorization: Bearer <ADMIN_TOKEN>"
```

---

## Testing Rollback Scenarios

### 1. Invalid Dish in Order
```bash
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer <WAITER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"customer_id":1,"employee_id":2,"items":[{"dish_id":99999,"quantity":1}]}'
```
Returns 404. Check logs/transactions.log for rollback entry.

### 2. Double Booking a Table
```bash
# First reservation succeeds
curl -X POST http://localhost:3000/api/v1/reservations \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"customer_id":1,"table_id":1,"reservation_time":"2026-04-01T20:00:00"}'

# Second reservation on same table/time fails with 409
curl -X POST http://localhost:3000/api/v1/reservations \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"customer_id":2,"table_id":1,"reservation_time":"2026-04-01T20:00:00"}'
```

### 3. Overlapping Shift
```bash
# First shift succeeds
curl -X POST http://localhost:3000/api/v1/shifts \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"employee_id":1,"start_time":"2026-03-15T10:00:00","end_time":"2026-03-15T14:00:00"}'

# Overlapping shift fails with 409
curl -X POST http://localhost:3000/api/v1/shifts \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"employee_id":1,"start_time":"2026-03-15T12:00:00","end_time":"2026-03-15T16:00:00"}'
```

### 4. Insufficient Inventory
```bash
# Set ingredient quantity to 0
curl -X PUT http://localhost:3000/api/v1/inventory/1 \
  -H "Authorization: Bearer <CHEF_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 0}'

# Process inventory for order using that ingredient - returns 409 with shortages
curl -X POST http://localhost:3000/api/v1/orders/1/process-inventory \
  -H "Authorization: Bearer <CHEF_TOKEN>"
```

### 5. CHECK Constraint Violation
```bash
# Attempt to create admin with invalid access_level
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"username":"test_admin","password":"test123","access_level":"Invalid"}'
```
Fails because CHECK constraint only allows 'Super' or 'Normal'.

---

## Logs

All logs are written to the logs/ directory:

| File | Content |
|------|---------|
| logs/combined.log | All requests and application events |
| logs/error.log | Error-level events only |
| logs/transactions.log | Every ROLLBACK and COMMIT event |

View rollback logs:
```bash
tail -f logs/transactions.log
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| NODE_ENV | development | development or production |
| DB_SERVER | localhost | SQL Server host |
| DB_PORT | 1433 | SQL Server port |
| DB_USER | — | Database username |
| DB_PASSWORD | — | Database password |
| DB_NAME | RestaurantDB | Database name |
| DB_CONNECTION_LIMIT | 10 | Max pool connections |
| DB_ENCRYPT | false | Use TLS (true for Azure SQL) |
| DB_TRUST_SERVER_CERT | true | Trust self-signed certificates |
| JWT_SECRET | — | Secret for JWT signing (min 32 chars) |
| JWT_EXPIRY | 8h | Token expiry duration |
| BCRYPT_ROUNDS | 12 | bcrypt cost factor |
| LOG_LEVEL | info | Winston log level |
| LOG_DIR | ./logs | Log file directory |

---

## Common Issues

### Cannot connect to SQL Server
- Verify SQL Server is running
- Check credentials in .env
- Ensure TCP/IP is enabled in SQL Server Configuration Manager

### JWT_SECRET missing
Add a long random string to JWT_SECRET in .env

### Database already exists
Drop and recreate:
```sql
DROP DATABASE RestaurantDB;
CREATE DATABASE RestaurantDB;
```

### Port 3000 in use
Change PORT in .env to a different value (e.g., 3001)

---

## Project Checklist

- REST API with proper HTTP methods, status codes, JSON responses, versioning /api/v1/
- JWT authentication with bcrypt password hashing (12 rounds)
- RBAC for Chef, Waiter, Cashier, and Admin (Super/Normal)
- 4 transaction scenarios with BEGIN/COMMIT/ROLLBACK in raw SQL
- Rollback events logged to logs/transactions.log
- OpenAPI 3.0 spec (swagger.yaml)
- Backend Explanation document
- Parameterized queries throughout
- No hardcoded credentials
- No plaintext passwords
- media/ folder for rollback screenshots
- README with setup and curl examples