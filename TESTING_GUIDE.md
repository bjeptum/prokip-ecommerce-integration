# Complete Testing Guide - Prokip E-Commerce Integration

## Overview
This guide provides **step-by-step instructions** to test the entire Prokip e-commerce integration locally using mock data. You don't need real API credentials - everything runs on your local machine.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Starting the Mock Servers](#starting-the-mock-servers)
4. [Starting the Backend](#starting-the-backend)
5. [Testing with Postman](#testing-with-postman)
6. [Frontend Testing](#frontend-testing)
7. [End-to-End Flow Testing](#end-to-end-flow-testing)
8. [Troubleshooting](#troubleshooting)
9. [Switching to Production](#switching-to-production)

---

## Prerequisites

### Required Software
- **Node.js**: v18 or higher ([Download](https://nodejs.org/))
- **PostgreSQL**: v14 or higher ([Download](https://www.postgresql.org/download/))
- **Postman**: Desktop app ([Download](https://www.postman.com/downloads/))
- **Terminal**: Command line interface

### Verify Installations
```bash
# Check Node.js version
node --version
# Should show v18.x.x or higher

# Check npm version
npm --version
# Should show 9.x.x or higher

# Check PostgreSQL
psql --version
# Should show PostgreSQL 14.x or higher
```

---

## Environment Setup

### Step 1: Verify Database Connection

1. **Check PostgreSQL is running:**
   ```bash
   # On Linux
   sudo systemctl status postgresql
   
   # On macOS
   brew services list | grep postgresql
   
   # On Windows
   # Check Services app for PostgreSQL service
   ```

2. **Verify database exists:**
   ```bash
   psql -U postgres -d prokip_ecommerce
   # If error, create database:
   psql -U postgres -c "CREATE DATABASE prokip_ecommerce;"
   ```

### Step 2: Configure Environment Variables

1. **Navigate to backend folder:**
   ```bash
   cd /home/strongestavenger/Brenda/Prokip/Engineering/prokip-ecommerce-integration/backend
   ```

2. **Verify `.env` file has mock settings:**
   ```bash
   cat .env
   ```

   **Expected content:**
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/prokip_ecommerce?schema=public"
   JWT_SECRET="your-super-secret-jwt-key-change-in-production"
   
   # Mock Mode - Set to true for local testing
   MOCK_MODE=true
   
   # Mock API URLs (only used when MOCK_MODE=true)
   MOCK_PROKIP_URL=http://localhost:4000/connector/api
   MOCK_SHOPIFY_URL=http://localhost:4001
   MOCK_WOO_URL=http://localhost:4002
   
   # Default Admin Credentials for Mock Testing
   DEFAULT_ADMIN_USER=admin
   DEFAULT_ADMIN_PASS=password123
   ```

   ⚠️ **Important**: `MOCK_MODE=true` enables local testing without real APIs

### Step 3: Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Expected packages:
# - express, prisma, @prisma/client
# - jsonwebtoken, bcryptjs
# - axios, oauth
# - cors, dotenv
```

### Step 4: Initialize Database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Verify tables created
npx prisma studio
# Opens browser at http://localhost:5555 showing database tables
```

**Expected tables:**
- `Connection` - Stores Shopify/WooCommerce connections
- `InventoryCache` - Tracks inventory levels
- `SalesLog` - Records synced sales
- `ProkipConfig` - Stores Prokip API configuration

---

## Starting the Mock Servers

### What are Mock Servers?
Mock servers simulate real APIs (Prokip, Shopify, WooCommerce) so you can test without actual credentials. They run locally on ports 4000-4002.

### Step 1: Start Mock Servers

**Open Terminal #1 (Mock APIs):**
```bash
cd /home/strongestavenger/Brenda/Prokip/Engineering/prokip-ecommerce-integration/backend
node tests/mock-servers.js
```

**Expected output:**
```
🎭 Mock Prokip API running on http://localhost:4000
   - GET  /connector/api/product (Get products)
   - GET  /connector/api/product-stock-report (Get inventory)
   - POST /connector/api/sell (Record sale)
   - POST /connector/api/sell-return (Record return)

🛍️  Mock Shopify API running on http://localhost:4001
   - POST /admin/oauth/access_token (OAuth)
   - GET  /admin/api/2026-01/products.json (Get products)
   - POST /admin/api/2026-01/products.json (Create product)
   - GET  /admin/api/2026-01/locations.json (Get locations)
   - POST /admin/api/2026-01/inventory_levels/set.json (Update inventory)

🛒 Mock WooCommerce API running on http://localhost:4002
   - GET  /wp-json/wc/v3/products (Get products)
   - POST /wp-json/wc/v3/products (Create product)
   - PUT  /wp-json/wc/v3/products/:id (Update product)
   - GET  /wp-json/wc/v3/orders (Get orders)
```

⚠️ **Leave this terminal running!** Mock servers must stay active for testing.

### Step 2: Verify Mock Servers (Quick Test)

**Open Terminal #2 (Testing):**
```bash
# Test Mock Prokip API
curl http://localhost:4000/connector/api/product \
  -H "Authorization: Bearer mock_prokip_api_key_12345"

# Expected response:
# [{"id":"PROD-001","name":"Wireless Mouse","sku":"PROD-001","price":25,"category":"Electronics"},...]

# Test Mock Shopify API
curl http://localhost:4001/admin/api/2026-01/products.json \
  -H "X-Shopify-Access-Token: mock_shopify_access_token"

# Expected response:
# {"products":[{"id":1,"title":"T-Shirt","variants":[{...}]},...]

# Test Mock WooCommerce API
curl http://localhost:4002/wp-json/wc/v3/products \
  -u "ck_mock_key:cs_mock_secret"

# Expected response:
# [{"id":1,"name":"Leather Wallet","sku":"WOO-001",...},...]
```

✅ **All three should return JSON data!**

---

## Starting the Backend

### Step 1: Start Backend Server

**Open Terminal #3 (Backend):**
```bash
cd /home/strongestavenger/Brenda/Prokip/Engineering/prokip-ecommerce-integration/backend
npm start
```

**Expected output:**
```
Server running on http://localhost:3000
Connected to database successfully
Mock mode enabled - using local mock APIs
```

⚠️ **Leave this terminal running!** Your backend server must stay active.

### Step 2: Verify Backend is Running

**Test health endpoint:**
```bash
curl http://localhost:3000/api/health
```

**Expected response:**
```json
{"status":"ok","timestamp":"2024-01-15T10:30:00.000Z"}
```

---

## Testing with Postman

### Step 1: Import Postman Collection

1. **Open Postman desktop app**
2. Click **Import** button (top left)
3. Select **File** tab
4. Browse to: `/home/strongestavenger/Brenda/Prokip/Engineering/prokip-ecommerce-integration/backend/tests/Postman-Collection.json`
5. Click **Import**

**Result:** You should see collection "Prokip E-Commerce Integration - Full Test Suite" with 8 folders.

### Step 2: Configure Collection Variables

1. **Click on collection name** (right-click → Edit)
2. Go to **Variables** tab
3. Verify these variables:
   - `base_url`: `http://localhost:3000`
   - `jwt_token`: (empty - will auto-fill after login)
   - `shopify_connection_id`: (empty - will auto-fill)
   - `woo_connection_id`: (empty - will auto-fill)

### Step 3: Run Tests in Order

#### 🔐 Test 1: Authentication

**Folder:** `1. Authentication > Login`

**Action:** Click **Send**

**Request Body:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Expected Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Login successful"
}
```

**Auto-saved:** JWT token is automatically saved to collection variables

**Validation:**
- ✅ Status code is 200
- ✅ `token` field exists
- ✅ Check Postman console: "JWT Token saved: ..."

---

#### ⚙️ Test 2: Prokip Configuration

**Folder:** `2. Prokip Configuration > Set Prokip Config`

**Action:** Click **Send**

**Request Body:**
```json
{
  "apiKey": "mock_prokip_api_key_12345",
  "baseUrl": "http://localhost:4000/connector/api"
}
```

**Expected Response (200 OK):**
```json
{
  "id": 1,
  "apiKey": "mock_prokip_api_key_12345",
  "baseUrl": "http://localhost:4000/connector/api"
}
```

**Validation:**
- ✅ Configuration saved to database
- ✅ Can now fetch products from Prokip

**Test Get Config:**
- Click `2. Prokip Configuration > Get Prokip Config`
- Should return same configuration

---

#### 🔗 Test 3: Create Store Connections

**Folder:** `3. Store Connections > Create Shopify Connection`

**Action:** Click **Send**

**Request Body:**
```json
{
  "platform": "shopify",
  "storeUrl": "test-store.myshopify.com",
  "accessToken": "mock_shopify_access_token"
}
```

**Expected Response (201 Created):**
```json
{
  "id": 1,
  "platform": "shopify",
  "storeUrl": "test-store.myshopify.com",
  "status": "active",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

**Auto-saved:** `shopify_connection_id` = 1

**Repeat for WooCommerce:**
- Click `3. Store Connections > Create WooCommerce Connection`
- Request body:
  ```json
  {
    "platform": "woocommerce",
    "storeUrl": "https://example.com",
    "consumerKey": "ck_mock_key",
    "consumerSecret": "cs_mock_secret"
  }
  ```

**Expected Response:**
```json
{
  "id": 2,
  "platform": "woocommerce",
  "storeUrl": "https://example.com",
  "status": "active"
}
```

**Validation:**
- ✅ Both connections created (IDs: 1 and 2)
- ✅ Status is "active"
- ✅ Check database: `npx prisma studio` → Connection table should show 2 rows

---

#### 📦 Test 4: Load Products

**Folder:** `4. Product Setup > Get All Products`

**Action:** Click **Send**

**Expected Response (200 OK):**
```json
{
  "prokipProducts": [
    {
      "id": "PROD-001",
      "name": "Wireless Mouse",
      "sku": "PROD-001",
      "price": 25,
      "category": "Electronics",
      "stock": 100
    },
    {
      "id": "PROD-002",
      "name": "USB Cable",
      "sku": "PROD-002",
      "price": 10,
      "category": "Accessories",
      "stock": 200
    },
    {
      "id": "PROD-003",
      "name": "Bluetooth Headphones",
      "sku": "PROD-003",
      "price": 75,
      "category": "Electronics",
      "stock": 50
    }
  ],
  "shopifyProducts": [
    {
      "id": 1,
      "title": "T-Shirt",
      "variants": [
        {
          "id": 101,
          "sku": "SHOP-001",
          "price": "19.99",
          "inventory_quantity": 150
        }
      ]
    },
    {
      "id": 2,
      "title": "Cap",
      "variants": [
        {
          "id": 102,
          "sku": "SHOP-002",
          "price": "14.99",
          "inventory_quantity": 80
        }
      ]
    }
  ],
  "wooProducts": [
    {
      "id": 1,
      "name": "Leather Wallet",
      "sku": "WOO-001",
      "price": "29.99",
      "stock_quantity": 60
    },
    {
      "id": 2,
      "name": "Phone Case",
      "sku": "WOO-002",
      "price": "12.99",
      "stock_quantity": 120
    }
  ]
}
```

**Validation:**
- ✅ 3 Prokip products returned
- ✅ 2 Shopify products returned
- ✅ 2 WooCommerce products returned
- ✅ All products have SKU, price, and stock data

---

#### ⬆️ Test 5: Push Products to Stores

**Folder:** `4. Product Setup > Push Products to Shopify`

**Action:** Click **Send**

**Request Body:**
```json
{
  "connectionId": 1,
  "productIds": ["PROD-001", "PROD-002"]
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "2 products pushed to Shopify",
  "details": [
    {
      "productId": "PROD-001",
      "shopifyId": 3,
      "status": "created"
    },
    {
      "productId": "PROD-002",
      "shopifyId": 4,
      "status": "created"
    }
  ]
}
```

**Validation:**
- ✅ Products created in mock Shopify
- ✅ Check mock server terminal - should show POST requests

**Repeat for WooCommerce:**
- Click `4. Product Setup > Push Products to WooCommerce`
- Request body:
  ```json
  {
    "connectionId": 2,
    "productIds": ["PROD-001", "PROD-003"]
  }
  ```

---

#### 🔄 Test 6: Pull Inventory from Prokip

**Folder:** `4. Product Setup > Pull Inventory from Prokip`

**Action:** Click **Send**

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Inventory synced for 3 products",
  "updates": [
    {
      "sku": "PROD-001",
      "prokipStock": 100,
      "updatedStores": ["shopify", "woocommerce"]
    },
    {
      "sku": "PROD-002",
      "prokipStock": 200,
      "updatedStores": ["shopify"]
    },
    {
      "sku": "PROD-003",
      "prokipStock": 50,
      "updatedStores": ["woocommerce"]
    }
  ]
}
```

**Validation:**
- ✅ Inventory pulled from Prokip API
- ✅ Store inventories updated
- ✅ Check `InventoryCache` table in Prisma Studio

---

#### ▶️ Test 7: Sync Operations

**Folder:** `5. Sync Operations`

**Test 7a: Get Sync Status**
- Click `Get Sync Status`
- Expected response:
  ```json
  {
    "isRunning": false,
    "lastSync": null,
    "nextSync": null
  }
  ```

**Test 7b: Resume Sync**
- Click `Resume Sync`
- Expected response:
  ```json
  {
    "success": true,
    "message": "Sync resumed",
    "status": "running"
  }
  ```

**Test 7c: Check Status Again**
- Click `Get Sync Status`
- Expected response:
  ```json
  {
    "isRunning": true,
    "lastSync": "2024-01-15T10:35:00.000Z",
    "nextSync": "2024-01-15T10:40:00.000Z"
  }
  ```

**Test 7d: Pause Sync**
- Click `Pause Sync`
- Expected response:
  ```json
  {
    "success": true,
    "message": "Sync paused"
  }
  ```

**Test 7e: Manual Sync Now**
- Click `Manual Sync Now`
- Expected response:
  ```json
  {
    "success": true,
    "message": "Manual sync completed",
    "salesProcessed": 0,
    "inventoryUpdated": 3
  }
  ```

**Validation:**
- ✅ Sync can be paused/resumed
- ✅ Manual sync triggers immediately
- ✅ Check backend terminal for sync logs

---

#### 🔔 Test 8: Webhooks

**Folder:** `6. Webhooks (Shopify) > Shopify Order Created Webhook`

**Action:** Click **Send**

**Request Body:**
```json
{
  "id": 12345,
  "line_items": [
    {
      "sku": "PROD-001",
      "quantity": 2,
      "price": "25.00"
    }
  ],
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Order synced to Prokip",
  "prokipReference": "SHOP-12345"
}
```

**Validation:**
- ✅ Order sent to Prokip API
- ✅ Check `SalesLog` table - should show new entry
- ✅ Check mock Prokip terminal - should show POST to /sell

**Test WooCommerce Webhook:**
- Click `7. Webhooks (WooCommerce) > WooCommerce Order Created Webhook`
- Request body:
  ```json
  {
    "id": 456,
    "line_items": [
      {
        "sku": "PROD-003",
        "quantity": 1,
        "price": 75
      }
    ],
    "date_created": "2024-01-15T11:00:00"
  }
  ```

---

#### 🧪 Test 9: Direct Mock API Testing

**Folder:** `8. Mock API Testing`

These requests test mock servers directly (bypassing your backend).

**Test 9a: Mock Prokip - Get Products**
- Click `Mock Prokip - Get Products`
- Expected: List of 3 Prokip products

**Test 9b: Mock Shopify - Get Products**
- Click `Mock Shopify - Get Products`
- Expected: List of 2 Shopify products

**Test 9c: Mock WooCommerce - Get Products**
- Click `Mock WooCommerce - Get Products`
- Expected: List of 2 WooCommerce products

**Validation:**
- ✅ All mock APIs responding correctly
- ✅ Data matches expected format

---

## Frontend Testing

### Step 1: Open Frontend

1. **Open browser**
2. Navigate to: `http://localhost:3000`
3. You should see the login page

**Screenshot expectation:**
```
+----------------------------------+
|   Prokip E-Commerce Integration  |
|   ============================   |
|   Username: [____________]       |
|   Password: [____________]       |
|   [        Login        ]        |
+----------------------------------+
```

### Step 2: Login

**Credentials:**
- Username: `admin`
- Password: `password123`

**Expected result:**
- ✅ Redirects to dashboard
- ✅ Shows "Prokip Configuration", "Store Connections", "Product Setup" sections

### Step 3: Configure Prokip

1. **Find "Prokip Configuration" section**
2. **Fill in:**
   - API Key: `mock_prokip_api_key_12345`
   - Base URL: `http://localhost:4000/connector/api`
3. **Click "Save Configuration"**

**Expected result:**
- ✅ Success message: "Configuration saved successfully"
- ✅ Green checkmark appears

### Step 4: Add Store Connections

**Add Shopify:**
1. **Find "Store Connections" section**
2. **Click "Add Shopify"**
3. **Fill in:**
   - Store URL: `test-store.myshopify.com`
   - Access Token: `mock_shopify_access_token`
4. **Click "Connect"**

**Expected result:**
- ✅ Success message
- ✅ Card shows "Shopify - test-store.myshopify.com - Active"
- ✅ Options: Pause, Disconnect

**Add WooCommerce:**
1. **Click "Add WooCommerce"**
2. **Fill in:**
   - Store URL: `https://example.com`
   - Consumer Key: `ck_mock_key`
   - Consumer Secret: `cs_mock_secret`
3. **Click "Connect"**

**Expected result:**
- ✅ WooCommerce connection appears below Shopify

### Step 5: Load Products

1. **Find "Product Setup" section**
2. **Click "Load Products"**

**Expected result:**
- ✅ Table appears showing:

```
| □ | SKU       | Name                   | Price | Stock | Source |
|---|-----------|------------------------|-------|-------|--------|
| □ | PROD-001  | Wireless Mouse         | $25   | 100   | Prokip |
| □ | PROD-002  | USB Cable              | $10   | 200   | Prokip |
| □ | PROD-003  | Bluetooth Headphones   | $75   | 50    | Prokip |
| □ | SHOP-001  | T-Shirt                | $20   | 150   | Shopify|
| □ | SHOP-002  | Cap                    | $15   | 80    | Shopify|
| □ | WOO-001   | Leather Wallet         | $30   | 60    | WooCommerce |
| □ | WOO-002   | Phone Case             | $13   | 120   | WooCommerce |
```

### Step 6: Push Products to Store

1. **Check boxes next to PROD-001 and PROD-002**
2. **Select "Shopify" from dropdown**
3. **Click "Push to Store"**

**Expected result:**
- ✅ Progress indicator
- ✅ Success message: "2 products pushed to Shopify"
- ✅ Console logs showing API calls (check browser DevTools)

### Step 7: Pull Inventory

1. **Click "Pull Inventory from Prokip"**

**Expected result:**
- ✅ Progress indicator
- ✅ Success message: "Inventory synced for 3 products"
- ✅ Table updates with new stock quantities

### Step 8: Test Sync Controls

**Resume Sync:**
1. **Find "Sync Controls" section**
2. **Click "Resume Sync"**

**Expected result:**
- ✅ Status changes to "Running"
- ✅ "Last Sync" timestamp appears
- ✅ "Pause Sync" button becomes active

**Pause Sync:**
1. **Click "Pause Sync"**

**Expected result:**
- ✅ Status changes to "Paused"
- ✅ "Resume Sync" button becomes active

**Manual Sync:**
1. **Click "Sync Now"**

**Expected result:**
- ✅ Immediate sync executes
- ✅ Timestamp updates
- ✅ Success message

### Step 9: Test Disconnect

1. **Find Shopify connection card**
2. **Click "Disconnect"**

**Expected result:**
- ✅ Confirmation dialog appears
- ✅ After confirming, connection is removed
- ✅ Card disappears from list

---

## End-to-End Flow Testing

### Complete Integration Flow

This tests the entire system working together:

**Scenario:** Customer orders from Shopify → Inventory updates in Prokip

**Step 1: Setup** (If not already done)
- ✅ Prokip configured
- ✅ Shopify connected
- ✅ Products pushed (PROD-001 to Shopify)
- ✅ Sync running

**Step 2: Simulate Shopify Order**

Use Postman:
```
POST http://localhost:3000/api/webhooks/shopify/orders/create

Headers:
  X-Shopify-Shop-Domain: test-store.myshopify.com
  Content-Type: application/json

Body:
{
  "id": 99999,
  "line_items": [
    {
      "sku": "PROD-001",
      "quantity": 5,
      "price": "25.00"
    }
  ],
  "created_at": "2024-01-15T12:00:00Z"
}
```

**Step 3: Verify in Backend Terminal**

Look for logs:
```
[Webhook] Shopify order received: 99999
[Sync] Processing order to Prokip...
[Prokip] Sale recorded: SHOP-99999
[Success] Order synced successfully
```

**Step 4: Verify in Mock Prokip Terminal**

Look for:
```
[POST] /connector/api/sell - Recording sale SHOP-99999
  Items: PROD-001 x5 @ $25.00
  Total: $125.00
```

**Step 5: Check Database**

In Prisma Studio (`npx prisma studio`):
- **SalesLog table**: New row with reference "SHOP-99999"
- **InventoryCache table**: PROD-001 stock updated

**Step 6: Verify Inventory Sync Back to Stores**

Wait 5 minutes (or trigger manual sync), then:

In Postman:
```
POST http://localhost:3000/api/sync/now
```

Expected response:
```json
{
  "success": true,
  "salesProcessed": 1,
  "inventoryUpdated": 1
}
```

**Step 7: Check Mock Shopify Terminal**

Look for:
```
[POST] /admin/api/2026-01/inventory_levels/set.json
  Inventory updated: PROD-001 → 95 (was 100, sold 5)
```

**Validation:**
- ✅ Order webhook received
- ✅ Sale sent to Prokip
- ✅ Database logged correctly
- ✅ Inventory synced back to Shopify
- ✅ End-to-end flow working!

---

## Troubleshooting

### Issue 1: Mock Servers Not Starting

**Error:** `Port 4000 already in use`

**Solution:**
```bash
# Find process using port
lsof -i :4000
# Kill process
kill -9 <PID>

# Or use different ports - edit mock-servers.js:
# Change 4000 → 4010, 4001 → 4011, 4002 → 4012
# Then update .env file with new ports
```

### Issue 2: Backend Can't Connect to Database

**Error:** `Can't reach database server`

**Solution:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Verify DATABASE_URL in .env matches your setup
# Update password if needed:
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/prokip_ecommerce"
```

### Issue 3: Postman Returns 401 Unauthorized

**Error:** All requests return 401

**Solution:**
1. **Re-run login request** in Postman
2. **Check JWT token** is saved to collection variables
3. **Verify Authorization header** is set to `Bearer {{jwt_token}}`
4. **Check token expiry** - JWT tokens expire after 24h

### Issue 4: Products Not Loading

**Error:** `GET /api/setup/products` returns empty arrays

**Solution:**
```bash
# Verify mock servers are running
curl http://localhost:4000/connector/api/product \
  -H "Authorization: Bearer mock_prokip_api_key_12345"

# Check MOCK_MODE is true in .env
grep MOCK_MODE backend/.env

# Check Prokip config is saved
npx prisma studio
# Open ProkipConfig table - should have apiKey set
```

### Issue 5: Webhooks Failing

**Error:** `POST /api/webhooks/shopify/orders/create` returns 500

**Solution:**
1. **Check connection exists:**
   ```bash
   curl http://localhost:3000/api/connections \
     -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
   ```
2. **Verify shop domain matches** X-Shopify-Shop-Domain header
3. **Check backend logs** for detailed error messages

### Issue 6: Frontend Not Loading

**Error:** `ERR_CONNECTION_REFUSED` at http://localhost:3000

**Solution:**
1. **Verify backend is running:**
   ```bash
   ps aux | grep node
   # Should show: node src/app.js
   ```
2. **Check port 3000 not blocked:**
   ```bash
   curl http://localhost:3000
   # Should return HTML
   ```
3. **Restart backend:**
   ```bash
   cd backend
   npm start
   ```

---

## Switching to Production

When ready to test with real APIs:

### Step 1: Update Environment

Edit `backend/.env`:
```env
# Disable mock mode
MOCK_MODE=false

# Add real Prokip credentials
PROKIP_API_KEY=your_real_api_key_here
PROKIP_BASE_URL=https://api.prokip.africa/connector/api
```

### Step 2: Real Shopify Setup

**Option A: Using Shopify Partner Dashboard**
1. Create Shopify Partner account
2. Create development store
3. Install custom app
4. Get access token

**Option B: Using OAuth Flow**
1. Register app with Shopify
2. Implement OAuth callback
3. Get access token from authorization

Update connection:
```json
{
  "platform": "shopify",
  "storeUrl": "your-real-store.myshopify.com",
  "accessToken": "shpat_xxxxxxxxxxxxxxxxxxxxx"
}
```

### Step 3: Real WooCommerce Setup

1. **Install WooCommerce** on WordPress site
2. **Generate API keys:**
   - WooCommerce → Settings → Advanced → REST API
   - Create new key with Read/Write permissions
3. **Update connection:**
   ```json
   {
     "platform": "woocommerce",
     "storeUrl": "https://yourdomain.com",
     "consumerKey": "ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
     "consumerSecret": "cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   }
   ```

### Step 4: Test Production

**Important:** Start with small tests!

1. **Test with 1 product first**
2. **Verify inventory updates correctly**
3. **Test one order webhook**
4. **Monitor for errors**
5. **Gradually scale up**

### Step 5: Production Monitoring

Set up logging:
```javascript
// Add to app.js
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

---

## Summary Checklist

### Before Testing
- [ ] PostgreSQL running
- [ ] Database created and migrated
- [ ] `.env` file configured with `MOCK_MODE=true`
- [ ] Dependencies installed (`npm install`)

### During Testing
- [ ] Mock servers running (Terminal #1)
- [ ] Backend server running (Terminal #2)
- [ ] All Postman tests passing (9/9)
- [ ] Frontend loads and functions
- [ ] End-to-end flow tested

### Production Ready
- [ ] `MOCK_MODE=false` in production .env
- [ ] Real API credentials added
- [ ] Tested with real stores (small scale)
- [ ] Monitoring and logging set up
- [ ] Error handling tested
- [ ] Backup strategy in place

---

## Next Steps

1. **Complete all tests** using this guide
2. **Document any errors** you encounter
3. **Test edge cases** (out of stock, invalid SKUs, etc.)
4. **Performance test** with multiple concurrent requests
5. **Security review** before production
6. **Deploy to staging** environment
7. **Final production testing** with real stores

---

## Support

If you encounter issues not covered here:

1. **Check backend logs** for detailed error messages
2. **Use Prisma Studio** to inspect database state
3. **Review mock server logs** for API call details
4. **Use browser DevTools** for frontend debugging
5. **Enable debug mode** in .env: `DEBUG=true`

---

**Last Updated:** 2024-01-15  
**Version:** 1.0  
**Author:** GitHub Copilot
