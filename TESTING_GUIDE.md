# Testing Guide - Prokip E-commerce Integration

## Overview

This guide covers testing the Prokip E-commerce Integration system, including manual testing workflows and mock server setup for development.

---

## Prerequisites

1. PostgreSQL database running
2. Environment variables configured in `/backend/.env`
3. Node.js and npm installed
4. Database migrations applied (`npx prisma migrate dev`)

---

## Quick Start

### Start the Backend Server

```bash
cd backend
npm start
```

Expected output:
```
✅ Database connected
🚀 Server running on http://localhost:3000
```

### Access the Dashboard

Open your browser to: `http://localhost:3000`

---

## Test Scenarios

### Scenario 1: Prokip Login

**Steps:**
1. Open `http://localhost:3000`
2. Enter your Prokip username (e.g., `JTB`)
3. Enter your Prokip password
4. Click "Login"

**Expected Result:**
- Login successful
- Business location selection screen appears
- Your Prokip business locations are displayed

**Verification:**
- Check server logs for `POST /auth/prokip-login`
- Token should be stored in database (`prokip_config` table)

### Scenario 2: Select Business Location

**Prerequisites:** Logged in to Prokip

**Steps:**
1. Select a business location from the dropdown
2. Click "Continue"

**Expected Result:**
- Dashboard loads
- Sidebar shows connected stores (if any)
- Prokip Operations page displays products

**Verification:**
- Check server logs for `POST /auth/prokip-location`
- Location ID stored in `prokip_config`

### Scenario 3: Connect Shopify Store

**Prerequisites:** 
- Logged in with Prokip credentials
- Shopify Partner app configured
- `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `REDIRECT_URI` set in `.env`

**Steps:**
1. Click "Connect Shopify" button
2. Enter your store URL (e.g., `your-store.myshopify.com`)
3. Click "Connect"
4. Authorize the app in Shopify popup

**Expected Result:**
- Redirected back to dashboard with success message
- Store appears in sidebar under "Connected Stores"
- Webhooks registered (products/update, products/create, inventory_levels/update)

**Verification:**
- Check server logs for successful OAuth callback
- Connection created in `connections` table
- Webhooks visible in Shopify admin under Notifications

### Scenario 4: Connect WooCommerce Store

**Prerequisites:**
- Logged in with Prokip credentials
- WooCommerce store with REST API enabled
- Application Password created

**Steps:**
1. Click "Connect WooCommerce" button
2. Enter store URL (e.g., `https://your-store.com`)
3. Enter WordPress username
4. Enter Application Password
5. Click "Connect"

**Expected Result:**
- Success message appears
- Store appears in sidebar
- Test API call succeeds

**Verification:**
- Check server logs for `POST /connections/woocommerce/connect`
- Connection created with `platform: 'woocommerce'`

### Scenario 5: View Prokip Products

**Prerequisites:** Logged in with business location selected

**Steps:**
1. Click "Prokip Operations" in sidebar
2. View the Products section

**Expected Result:**
- Products list displays with:
  - Product name
  - SKU
  - Price (in your business currency)
  - Stock quantity
- Refresh button works

**Verification:**
- Check server logs for `GET /prokip/products`
- Products match your Prokip inventory

### Scenario 6: View Prokip Sales

**Prerequisites:** Logged in with business location selected

**Steps:**
1. Click "Prokip Operations" in sidebar
2. Click "Refresh" button in Sales section

**Expected Result:**
- Sales list displays with:
  - Invoice number
  - Customer name
  - Total amount
  - Date
  - Status badge

**Verification:**
- Check server logs for `GET /prokip/sales`
- Sales match your Prokip records

### Scenario 7: View Connected Store Products

**Prerequisites:** Store connected (Shopify or WooCommerce)

**Steps:**
1. Click on a connected store in the sidebar
2. View the Products tab

**Expected Result:**
- Store products displayed with:
  - Product name
  - SKU
  - Price
  - Stock quantity
- Sync button available

**Verification:**
- Check server logs for `GET /stores/:id/products`
- Products match the connected store

### Scenario 8: Sync Inventory from Prokip to Store

**Prerequisites:** 
- Store connected
- Products with matching SKUs in both Prokip and store

**Steps:**
1. Click on a connected store in sidebar
2. Click "Sync Products" button
3. Select "Sync Inventory from Prokip"

**Expected Result:**
- Progress indicator shows
- Success message with sync results:
  - Number of products synced
  - Any errors encountered
- Inventory updated in connected store

**Verification:**
- Check server logs for `POST /sync/inventory`
- Verify inventory quantities in Shopify/WooCommerce admin
- Check `inventory_logs` table for sync records

### Scenario 9: View Store Orders

**Prerequisites:** Store connected with orders

**Steps:**
1. Click on a connected store in sidebar
2. Click "Orders" tab

**Expected Result:**
- Orders list displays with:
  - Order number
  - Customer name
  - Total amount
  - Status
  - Source indicator (Store)

**Verification:**
- Check server logs for `GET /stores/:id/orders`
- Orders match the connected store

### Scenario 10: View Store Analytics

**Prerequisites:** Store connected

**Steps:**
1. Click on a connected store in sidebar
2. Click "Analytics" tab

**Expected Result:**
- Analytics page displays with:
  - Connection information
  - Sync statistics
  - Recent activity

**Verification:**
- Check server logs for `GET /sync/status`

---

## Mock Server Testing

For development without real API access, you can use mock servers.

### Start Mock Prokip Server

```bash
cd backend/tests
node mock-prokip-api.js
```

Expected output:
```
Mock Prokip API Server running on http://localhost:4000
```

### Configure for Mock Mode

In `.env`:
```dotenv
MOCK_PROKIP=true
MOCK_PROKIP_URL=http://localhost:4000
```

---

## API Testing with Postman

Import the Postman collection from `backend/tests/Postman-Collection.json`

### Key Endpoints to Test

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/prokip-login` | POST | Login with Prokip credentials |
| `/auth/prokip-location` | POST | Set business location |
| `/prokip/products` | GET | Get Prokip products |
| `/prokip/sales` | GET | Get Prokip sales |
| `/prokip/purchases` | GET | Get Prokip purchases |
| `/connections` | GET | List all connections |
| `/connections/shopify/initiate` | POST | Start Shopify OAuth |
| `/connections/woocommerce/connect` | POST | Connect WooCommerce |
| `/stores/:id/products` | GET | Get store products |
| `/stores/:id/orders` | GET | Get store orders |
| `/sync/status` | GET | Get sync status |
| `/sync/inventory` | POST | Sync inventory to store |

---

## Error Scenarios

### Test: Invalid Prokip Credentials

**Steps:**
1. Enter wrong username/password
2. Click Login

**Expected:**
- Error message "Authentication failed. Please check your credentials."
- No token stored

### Test: Shopify OAuth Cancellation

**Steps:**
1. Start Shopify connection
2. Click "Cancel" in Shopify authorization

**Expected:**
- Redirected back to dashboard
- Error message displayed
- No connection created

### Test: Invalid Store URL

**Steps:**
1. Enter invalid store URL for WooCommerce
2. Click Connect

**Expected:**
- Connection fails with error message
- No connection created

### Test: Sync with No Matching SKUs

**Steps:**
1. Connect a store with products
2. Ensure no SKUs match Prokip products
3. Run inventory sync

**Expected:**
- Sync completes but with 0 products synced
- No errors, just no matches found

---

## Database Verification

### Check Prokip Config

```sql
SELECT * FROM prokip_config;
```

Should show:
- Token (access token)
- Refresh token
- Expiry time
- Location ID

### Check Connections

```sql
SELECT id, platform, "storeUrl", "storeName", "syncEnabled" FROM connections;
```

### Check Inventory Logs

```sql
SELECT * FROM inventory_logs ORDER BY "lastSynced" DESC LIMIT 10;
```

### Check Sales Logs

```sql
SELECT * FROM sales_logs ORDER BY "syncedAt" DESC LIMIT 10;
```

---

## Troubleshooting Tests

### Server Won't Start

```bash
# Check for port conflicts
lsof -i :3000

# Check database connection
psql -h localhost -U postgres -d prokip_integration -c "SELECT 1"

# Check environment variables
cat .env | grep DATABASE_URL
```

### API Returns 500 Error

```bash
# Check server logs for stack trace
npm start 2>&1 | tee server.log

# Check Prisma client is generated
npx prisma generate
```

### Shopify OAuth Fails

1. Verify `REDIRECT_URI` matches Shopify app settings exactly
2. Check `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET`
3. Ensure HTTPS is used in production

### Inventory Sync Fails

1. Check Shopify scopes include `read_inventory`, `write_inventory`, `read_locations`
2. Verify products have matching SKUs
3. Check store has inventory tracking enabled

---

## Performance Testing

### Load Test Sync Endpoint

```bash
# Using curl in a loop
for i in {1..10}; do
  curl -X POST http://localhost:3000/sync/inventory \
    -H "Content-Type: application/json" \
    -d '{"connectionId": 1}'
done
```

### Monitor Database Connections

```sql
SELECT count(*) FROM pg_stat_activity WHERE datname = 'prokip_integration';
```
