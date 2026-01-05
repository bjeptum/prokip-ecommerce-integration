# Mock Server Testing Guide

## Overview

This guide explains how to test the Prokip E-commerce Integration locally using mock servers that simulate Shopify, WooCommerce, and Prokip APIs. This allows you to develop and test without needing actual store connections or API credentials.

---

## Quick Start

### 1. Enable Mock Mode

Edit `backend/.env`:

```dotenv
MOCK_MODE=true
```

### 2. Start Mock Servers

```bash
cd backend
node tests/mock-servers.js
```

You should see:
```
Mock Prokip API running on http://localhost:4000
Mock Shopify API running on http://localhost:4001
Mock WooCommerce API running on http://localhost:4002
```

### 3. Start Backend

In a new terminal:

```bash
cd backend
npm start
```

### 4. Open Frontend

Navigate to `http://localhost:3000` in your browser.

---

## Mock Server Architecture

```
┌─────────────────────────────────────────────┐
│         Frontend (localhost:3000)           │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│     Backend API (localhost:3000/api)        │
│                                             │
│  When MOCK_MODE=true, uses:                 │
│  - http://localhost:4000 (Prokip)           │
│  - http://localhost:4001 (Shopify)          │
│  - http://localhost:4002 (WooCommerce)      │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
   ┌─────────┐ ┌─────────┐ ┌─────────┐
   │ Prokip  │ │ Shopify │ │  Woo    │
   │  Mock   │ │  Mock   │ │  Mock   │
   │  :4000  │ │  :4001  │ │  :4002  │
   └─────────┘ └─────────┘ └─────────┘
```

---

## Mock Prokip API (Port 4000)

### Base URL
`http://localhost:4000`

### Endpoints

#### GET /inventory/:locationId
Returns mock product inventory.

**Request:**
```bash
curl http://localhost:4000/inventory/1
```

**Response:**
```json
{
  "products": [
    {
      "sku": "PROD-001",
      "name": "Sample Product 1",
      "quantity": 100,
      "price": 29.99
    },
    {
      "sku": "PROD-002",
      "name": "Sample Product 2",
      "quantity": 50,
      "price": 49.99
    }
  ]
}
```

#### POST /sales
Records a sale transaction.

**Request:**
```bash
curl -X POST http://localhost:4000/sales \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "1",
    "sku": "PROD-001",
    "quantity": 2,
    "price": 29.99,
    "orderId": "ORDER-123"
  }'
```

**Response:**
```json
{
  "success": true,
  "sellId": "SELL-12345",
  "message": "Sale recorded successfully"
}
```

#### PUT /inventory/:locationId/:sku
Updates product inventory quantity.

**Request:**
```bash
curl -X PUT http://localhost:4000/inventory/1/PROD-001 \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 95
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Inventory updated"
}
```

---

## Mock Shopify API (Port 4001)

### Base URL
`http://localhost:4001`

### OAuth Flow

#### 1. Authorization Request
The backend will construct this URL:

```
http://localhost:4001/admin/oauth/authorize?
  client_id=mock_client_id&
  scope=read_products,write_products,read_orders,write_orders&
  redirect_uri=http://localhost:3000/connections/callback/shopify&
  state=random_state
```

When you visit this URL, the mock server automatically redirects back with a code:

```
http://localhost:3000/connections/callback/shopify?
  code=mock_auth_code&
  shop=mystore.myshopify.com&
  state=random_state
```

#### 2. Token Exchange
Backend exchanges code for access token:

**Request:**
```bash
curl -X POST http://localhost:4001/admin/oauth/access_token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "mock_client_id",
    "client_secret": "mock_client_secret",
    "code": "mock_auth_code"
  }'
```

**Response:**
```json
{
  "access_token": "mock_access_token_12345",
  "scope": "read_products,write_products,read_orders,write_orders"
}
```

### Product Endpoints

#### GET /admin/api/2026-01/products.json
Get all products.

**Headers:**
```
X-Shopify-Access-Token: mock_access_token_12345
```

**Response:**
```json
{
  "products": [
    {
      "id": 1234567890,
      "title": "Mock Shopify Product 1",
      "variants": [
        {
          "id": 9876543210,
          "sku": "SHOPIFY-001",
          "price": "39.99",
          "inventory_quantity": 75,
          "inventory_item_id": 5555555555
        }
      ]
    },
    {
      "id": 1234567891,
      "title": "Mock Shopify Product 2",
      "variants": [
        {
          "id": 9876543211,
          "sku": "SHOPIFY-002",
          "price": "59.99",
          "inventory_quantity": 25,
          "inventory_item_id": 5555555556
        }
      ]
    }
  ]
}
```

#### POST /admin/api/2026-01/products.json
Create a new product.

**Request:**
```bash
curl -X POST http://localhost:4001/admin/api/2026-01/products.json \
  -H "X-Shopify-Access-Token: mock_access_token_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "product": {
      "title": "New Product",
      "variants": [
        {
          "sku": "NEW-001",
          "price": "29.99",
          "inventory_quantity": 100
        }
      ]
    }
  }'
```

**Response:**
```json
{
  "product": {
    "id": 1234567892,
    "title": "New Product",
    "variants": [
      {
        "id": 9876543212,
        "sku": "NEW-001",
        "price": "29.99",
        "inventory_quantity": 100,
        "inventory_item_id": 5555555557
      }
    ]
  }
}
```

#### POST /admin/api/2026-01/inventory_levels/set.json
Update inventory quantity.

**Request:**
```bash
curl -X POST http://localhost:4001/admin/api/2026-01/inventory_levels/set.json \
  -H "X-Shopify-Access-Token: mock_access_token_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "inventory_item_id": 5555555555,
    "location_id": 11111,
    "available": 80
  }'
```

**Response:**
```json
{
  "inventory_level": {
    "inventory_item_id": 5555555555,
    "location_id": 11111,
    "available": 80,
    "updated_at": "2026-01-05T12:00:00Z"
  }
}
```

### Webhook Endpoints

#### POST /admin/api/2026-01/webhooks.json
Register a webhook.

**Request:**
```bash
curl -X POST http://localhost:4001/admin/api/2026-01/webhooks.json \
  -H "X-Shopify-Access-Token: mock_access_token_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "topic": "orders/create",
      "address": "http://localhost:3000/connections/webhook/shopify",
      "format": "json"
    }
  }'
```

**Response:**
```json
{
  "webhook": {
    "id": 99999,
    "topic": "orders/create",
    "address": "http://localhost:3000/connections/webhook/shopify",
    "format": "json",
    "created_at": "2026-01-05T12:00:00Z"
  }
}
```

### Simulate Webhook Events

To test webhook handling, send a POST request to your backend:

```bash
curl -X POST http://localhost:3000/connections/webhook/shopify \
  -H "X-Shopify-Topic: orders/create" \
  -H "X-Shopify-Shop-Domain: mystore.myshopify.com" \
  -H "X-Shopify-Hmac-Sha256: mock_hmac" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 123456789,
    "line_items": [
      {
        "sku": "PROD-001",
        "quantity": 2,
        "price": "29.99"
      }
    ],
    "total_price": "59.98"
  }'
```

---

## Mock WooCommerce API (Port 4002)

### Base URL
`http://localhost:4002`

### Authentication
WooCommerce uses Basic Auth (Base64 encoded `consumer_key:consumer_secret`).

**Mock Credentials:**
- Consumer Key: `ck_mock_key`
- Consumer Secret: `cs_mock_secret`

### Product Endpoints

#### GET /wp-json/wc/v3/products
Get all products.

**Request:**
```bash
curl http://localhost:4002/wp-json/wc/v3/products \
  -u ck_mock_key:cs_mock_secret
```

**Response:**
```json
[
  {
    "id": 100,
    "name": "Mock WooCommerce Product 1",
    "sku": "WOO-001",
    "price": "45.00",
    "stock_quantity": 60
  },
  {
    "id": 101,
    "name": "Mock WooCommerce Product 2",
    "sku": "WOO-002",
    "price": "65.00",
    "stock_quantity": 30
  }
]
```

#### POST /wp-json/wc/v3/products
Create a new product.

**Request:**
```bash
curl -X POST http://localhost:4002/wp-json/wc/v3/products \
  -u ck_mock_key:cs_mock_secret \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New WooCommerce Product",
    "sku": "WOO-003",
    "regular_price": "35.00",
    "stock_quantity": 100
  }'
```

**Response:**
```json
{
  "id": 102,
  "name": "New WooCommerce Product",
  "sku": "WOO-003",
  "regular_price": "35.00",
  "stock_quantity": 100
}
```

#### PUT /wp-json/wc/v3/products/:id
Update product inventory.

**Request:**
```bash
curl -X PUT http://localhost:4002/wp-json/wc/v3/products/100 \
  -u ck_mock_key:cs_mock_secret \
  -H "Content-Type: application/json" \
  -d '{
    "stock_quantity": 55
  }'
```

**Response:**
```json
{
  "id": 100,
  "stock_quantity": 55
}
```

### Webhook Endpoints

#### POST /wp-json/wc/v3/webhooks
Register a webhook.

**Request:**
```bash
curl -X POST http://localhost:4002/wp-json/wc/v3/webhooks \
  -u ck_mock_key:cs_mock_secret \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "order.created",
    "delivery_url": "http://localhost:3000/connections/webhook/woocommerce"
  }'
```

**Response:**
```json
{
  "id": 200,
  "topic": "order.created",
  "delivery_url": "http://localhost:3000/connections/webhook/woocommerce",
  "status": "active"
}
```

### Simulate Webhook Events

```bash
curl -X POST http://localhost:3000/connections/webhook/woocommerce \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "order.created",
    "resource": {
      "id": 300,
      "line_items": [
        {
          "sku": "PROD-002",
          "quantity": 1,
          "price": 49.99
        }
      ],
      "total": "49.99"
    }
  }'
```

---

## Testing Scenarios

### Scenario 1: Connect Shopify Store

1. Start mock servers and backend
2. Open frontend at `http://localhost:3000`
3. Login with credentials (register if needed)
4. Click "Module Settings"
5. Click "Shopify" card
6. Enter store URL: `mystore` (or any text)
7. Click "Connect"
8. You'll be redirected to mock OAuth page
9. Automatic redirect back with success notification
10. Dashboard should show 1 connection

**Expected Results:**
- ✅ OAuth flow completes without errors
- ✅ Success notification appears
- ✅ Connection saved in database
- ✅ Dashboard stats update

### Scenario 2: Connect WooCommerce Store

1. Click "Module Settings" → "WooCommerce"
2. Enter:
   - Store URL: `http://localhost:4002`
   - Consumer Key: `ck_mock_key`
   - Consumer Secret: `cs_mock_secret`
3. Click "Connect"

**Expected Results:**
- ✅ Success notification appears
- ✅ Connection saved
- ✅ Dashboard stats update

### Scenario 3: Sync Products from Prokip

1. Ensure Prokip is configured (Module Settings → Prokip)
   - Token: `Bearer mock_token`
   - Location ID: `1`
2. Navigate to "Sync" section
3. Click "Sync All Stores"

**Expected Results:**
- ✅ Products fetched from Prokip (PROD-001, PROD-002)
- ✅ Products pushed to Shopify
- ✅ Products pushed to WooCommerce
- ✅ Inventory cache updated
- ✅ Success notification

### Scenario 4: Process Shopify Order

1. Simulate webhook by running:
```bash
curl -X POST http://localhost:3000/connections/webhook/shopify \
  -H "X-Shopify-Topic: orders/create" \
  -H "X-Shopify-Shop-Domain: mystore.myshopify.com" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 123,
    "line_items": [{"sku": "PROD-001", "quantity": 2}]
  }'
```

**Expected Results:**
- ✅ Order received by webhook
- ✅ Sale sent to Prokip
- ✅ Prokip inventory decremented
- ✅ SalesLog entry created
- ✅ Console logs show "Sale sent to Prokip"

### Scenario 5: Process WooCommerce Order

```bash
curl -X POST http://localhost:3000/connections/webhook/woocommerce \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "order.created",
    "resource": {
      "id": 300,
      "line_items": [{"sku": "PROD-002", "quantity": 1}]
    }
  }'
```

**Expected Results:**
- ✅ Order processed
- ✅ Sale recorded in Prokip
- ✅ Inventory updated
- ✅ SalesLog created

---

## Mock Server Limitations

### What Works
- ✅ Complete OAuth flow simulation
- ✅ Product CRUD operations
- ✅ Inventory updates
- ✅ Webhook registration
- ✅ Order processing
- ✅ Authentication simulation

### What Doesn't Work
- ❌ Rate limiting (mocks don't enforce limits)
- ❌ Pagination (mocks return all data)
- ❌ Advanced Shopify features (metafields, etc.)
- ❌ Real webhook delivery (must simulate manually)
- ❌ Error scenarios (mocks always return success)

---

## Switching to Production

### 1. Update .env

```dotenv
# Change this
MOCK_MODE=false

# Add real credentials
SHOPIFY_CLIENT_ID=your_real_client_id
SHOPIFY_CLIENT_SECRET=your_real_client_secret
REDIRECT_URI=https://prokip.local/connections/callback/shopify
```

### 2. Configure HTTPS

Production Shopify requires HTTPS. Use Caddy or ngrok:

**Caddy (Caddyfile):**
```
prokip.local {
  reverse_proxy localhost:3000
}
```

**ngrok:**
```bash
ngrok http 3000
```

Update `REDIRECT_URI` and `WEBHOOK_URL` with your HTTPS URL.

### 3. Stop Mock Servers

Kill the `mock-servers.js` process.

### 4. Test with Real Store

Follow [SETUP.md](SETUP.md) for production configuration.

---

## Debugging Mock Servers

### Enable Verbose Logging

Edit `tests/mock-servers.js` and add:

```javascript
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});
```

### Check Mock Server Status

```bash
curl http://localhost:4000/health
curl http://localhost:4001/health
curl http://localhost:4002/health
```

### Restart Mock Servers

Press `Ctrl+C` to stop, then:

```bash
node tests/mock-servers.js
```

---

## Common Issues

### "EADDRINUSE: address already in use"

**Cause:** Port already occupied

**Solution:**
```bash
# Find process using port 4000
lsof -i :4000

# Kill it
kill -9 <PID>

# Or use different ports in mock-servers.js
```

### "Cannot connect to mock server"

**Cause:** Mock servers not running

**Solution:**
```bash
# Check if running
curl http://localhost:4000

# Start if not
node tests/mock-servers.js
```

### "OAuth redirect not working"

**Cause:** REDIRECT_URI mismatch

**Solution:**
Ensure `.env` has:
```dotenv
REDIRECT_URI=http://localhost:3000/connections/callback/shopify
```

---

## Advanced Testing

### Testing Error Handling

Modify mock server responses to return errors:

```javascript
// In mock-servers.js, change a route:
app.post('/admin/oauth/access_token', (req, res) => {
  // Simulate error
  res.status(400).json({ error: 'invalid_request' });
});
```

### Load Testing

Use Apache Bench or wrk:

```bash
ab -n 1000 -c 10 http://localhost:4000/inventory/1
```

---

**For setup instructions, see [SETUP.md](SETUP.md)**  
**For implementation details, see [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)**
