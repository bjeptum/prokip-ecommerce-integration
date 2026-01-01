# Implementation Guide: Prokip API Integration

## Overview
This guide walks you through implementing the Prokip integration properly by:
1. Testing the real Prokip API
2. Documenting actual responses
3. Creating local mock API that matches real responses
4. Testing locally
5. Switching to live API

---

## Phase 1: Test Real Prokip API (You - Backend)

### Step 1: Get Prokip Credentials
Contact Prokip to get:
- ✅ API Token
- ✅ Base URL (likely `https://api.prokip.africa`)
- ✅ Location/Branch ID
- ✅ API Documentation

### Step 2: Test All Endpoints

```bash
cd backend/tests

# Follow the guide in prokip-api-testing.md
# This will help you test and document all endpoints
```

**Critical endpoints to test:**
1. **GET Products** - `/connector/api/product`
2. **GET Inventory** - `/connector/api/inventory`
3. **POST Create Sale** - `/connector/api/sells`
4. **POST Refund** - `/connector/api/sells/{id}/refund`

### Step 3: Document Actual Responses

Create `backend/tests/prokip-api-documentation.md` with:

```markdown
## Get Products Endpoint

**Request:**
```
GET https://api.prokip.africa/connector/api/product?per_page=-1
Headers:
  Authorization: Bearer {token}
  Accept: application/json
```

**Response 200:**
```json
{
  // PASTE ACTUAL RESPONSE HERE
}
```

**Response 401:**
```json
{
  // PASTE ACTUAL ERROR RESPONSE HERE
}
```
```

Do this for ALL endpoints you'll use.

### Step 4: Save Response Samples

Save actual API responses as JSON files:
```bash
backend/tests/
├── prokip-products-response.json
├── prokip-inventory-response.json
├── prokip-create-sale-response.json
├── prokip-refund-response.json
└── prokip-api-documentation.md
```

---

## Phase 2: Update Local Mock API (You - Backend)

### Step 1: Update Mock API to Match Real API

Based on your documented responses, update `backend/tests/mock-prokip-api.js`:

```javascript
// Example: If real Prokip returns this structure:
{
  "success": true,
  "data": [...],
  "pagination": {...}
}

// Make sure your mock returns THE SAME structure
```

### Step 2: Run Mock API Locally

```bash
# Terminal 1: Start mock Prokip API
cd backend
node tests/mock-prokip-api.js

# Should show:
# Mock Prokip API running on http://localhost:4000
```

### Step 3: Configure Your App to Use Mock API

```bash
# backend/.env
PROKIP_API=http://localhost:4000
PROKIP_TOKEN=mock_prokip_token_123
PROKIP_LOCATION=LOC001
```

---

## Phase 3: Update Your Integration Code (You - Backend)

### Step 1: Update Service Files to Match Real API

Review and update these files based on actual Prokip API responses:

**File: `backend/src/services/prokipMapper.js`**
```javascript
// Update this to match ACTUAL Prokip response structure
function mapProkipProductToStore(prokipProduct) {
  return {
    title: prokipProduct.name,  // Verify this field name is correct
    sku: prokipProduct.sku,     // Verify this field name is correct
    price: prokipProduct.product_variations?.[0]?.variations?.[0]?.sell_price_inc_tax || 0,
    // Add more fields based on actual response
  };
}
```

**File: `backend/src/services/syncService.js`**
```javascript
async function pollProkipToStores() {
  const prokip = await prisma.prokipConfig.findUnique({ where: { id: 1 } });
  
  // Update endpoint path if different
  const response = await axios.get(
    `${prokip.apiUrl}/connector/api/inventory?location_id=${prokip.locationId}`,
    {
      headers: {
        Authorization: `Bearer ${prokip.token}`,
        Accept: 'application/json'
      }
    }
  );
  
  // Update based on actual response structure
  const inventory = response.data.data; // or response.data depending on actual API
  
  // Rest of your logic...
}
```

### Step 2: Add Proper Error Handling

```javascript
try {
  const response = await axios.get(prokipUrl, { headers });
  
  // Handle different response formats
  if (!response.data.success) {
    throw new Error(response.data.message || 'Prokip API error');
  }
  
  return response.data.data;
} catch (error) {
  console.error('Prokip API Error:', {
    status: error.response?.status,
    message: error.response?.data?.message,
    url: prokipUrl
  });
  throw error;
}
```

### Step 3: Update Webhook Processing

**File: `backend/src/services/syncService.js`**

Make sure the sale creation matches Prokip's expected format:

```javascript
async function processStoreToProkip(storeUrl, topic, data, platform) {
  // ... existing code ...
  
  // Update this to match Prokip's expected request format
  const prokipSaleData = {
    location_id: prokipConfig.locationId,
    contact_id: 'walk-in-customer', // or map from order data
    transaction_date: new Date().toISOString(),
    items: lineItems.map(item => ({
      product_id: item.product_id,  // You may need to map SKU to product_id
      variation_id: item.variation_id,
      quantity: item.quantity,
      unit_price: item.price
    }))
  };
  
  const response = await axios.post(
    `${prokipConfig.apiUrl}/connector/api/sells`,
    prokipSaleData,
    {
      headers: {
        Authorization: `Bearer ${prokipConfig.token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  // Update based on actual response
  const sellId = response.data.data.sell_id;
  
  // Save to SalesLog...
}
```

---

## Phase 4: Test Locally (You - Backend)

### Step 1: Start All Services

```bash
# Terminal 1: Mock Prokip API
cd backend
node tests/mock-prokip-api.js

# Terminal 2: Your Backend
cd backend
npm start

# Terminal 3: Test commands
```

### Step 2: Test Full Flow

```bash
# 1. Register & Login
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"test123"}' | jq -r '.token')

# 2. Configure Prokip (using mock API)
curl -X POST http://localhost:3000/connections/prokip \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "mock_prokip_token_123",
    "locationId": "LOC001"
  }'

# 3. Connect WooCommerce store
curl -X POST http://localhost:3000/connections/woocommerce \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "storeUrl": "https://test-store.com",
    "consumerKey": "ck_test",
    "consumerSecret": "cs_test"
  }'

# 4. Push products from Prokip to store
curl -X POST http://localhost:3000/setup/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "push",
    "connectionId": 1
  }'

# 5. Simulate order webhook
curl -X POST http://localhost:3000/connections/webhook/woocommerce \
  -H "Content-Type: application/json" \
  -d '{
    "id": 12345,
    "line_items": [
      {
        "sku": "TSHIRT-001",
        "quantity": 2
      }
    ]
  }'

# 6. Trigger manual sync
curl -X POST http://localhost:3000/sync \
  -H "Authorization: Bearer $TOKEN"
```

### Step 3: Verify Database

```bash
psql -h localhost -U postgres -d prokip_integration

SELECT * FROM "Connection";
SELECT * FROM "InventoryCache";
SELECT * FROM "SalesLog";
```

---

## Phase 5: Switch to Live Prokip API (You - Backend)

Once everything works with mock API:

### Step 1: Update Environment Variables

```bash
# backend/.env
PROKIP_API=https://api.prokip.africa
PROKIP_TOKEN=your_real_prokip_token_here
PROKIP_LOCATION=your_real_location_id
```

### Step 2: Test with Live API

```bash
# Restart your backend
npm start

# Test the same flow as Phase 4, but now hitting real Prokip API
```

### Step 3: Monitor Logs

```bash
# Watch for any errors
tail -f logs/app.log

# Or add logging to console
console.log('Prokip API Response:', response.data);
```

---

## What to Share with Frontend Developer

### 1. API Documentation

Create `FRONTEND_API_DOCS.md`:

```markdown
# Frontend API Documentation

## Base URL
```
http://localhost:3000
```

## Authentication

All protected endpoints require JWT token in header:
```
Authorization: Bearer {token}
```

## Endpoints

### 1. Register User
**POST** `/auth/register`

**Request:**
```json
{
  "username": "string",
  "password": "string (min 6 chars)"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "User registered"
}
```

### 2. Login
**POST** `/auth/login`

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response 200:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 3. Configure Prokip
**POST** `/connections/prokip` 🔒

**Request:**
```json
{
  "token": "string",
  "locationId": "string"
}
```

**Response 200:**
```json
{
  "success": true
}
```

### 4. Connect Shopify
**GET** `/connections/shopify?store={shop-url}` 🔒

**Redirects to Shopify OAuth**

### 5. Connect WooCommerce
**POST** `/connections/woocommerce` 🔒

**Request:**
```json
{
  "storeUrl": "https://example.com",
  "consumerKey": "ck_xxxxx",
  "consumerSecret": "cs_xxxxx"
}
```

**Response 200:**
```json
{
  "success": true
}
```

### 6. Get All Connections
**GET** `/connections/status` 🔒

**Response 200:**
```json
[
  {
    "id": 1,
    "platform": "shopify",
    "storeUrl": "mystore.myshopify.com",
    "lastSync": "2025-12-28T10:30:00Z"
  }
]
```

### 7. Disconnect Store
**POST** `/connections/disconnect` 🔒

**Request:**
```json
{
  "connectionId": 1
}
```

**Response 200:**
```json
{
  "success": true
}
```

### 8. Push Products
**POST** `/setup/products` 🔒

**Request:**
```json
{
  "method": "push",
  "connectionId": 1
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Products pushed successfully"
}
```

### 9. Manual Sync
**POST** `/sync` 🔒

**Response 200:**
```json
{
  "success": true,
  "message": "Manual sync triggered"
}
```

## Error Responses

All errors follow this format:
```json
{
  "error": "Error message here",
  "details": "Additional details if available"
}
```

Common status codes:
- `400` - Bad request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `404` - Not found
- `500` - Server error
```

### 2. Frontend Implementation Checklist

Share this with frontend dev:

```markdown
# Frontend Implementation Checklist

## Required Changes

### 1. Update API Endpoints
- [ ] Change base URL to point to backend server
- [ ] Update all endpoint paths to match backend routes
- [ ] Add proper error handling for all API calls

### 2. Authentication Flow
- [ ] Implement login form
- [ ] Store JWT token in localStorage/sessionStorage
- [ ] Add token to all API requests
- [ ] Handle token expiration (401 responses)
- [ ] Implement logout functionality

### 3. Connection Management
- [ ] Update Shopify OAuth redirect handling
- [ ] Update WooCommerce connection form
- [ ] Display connection status from API
- [ ] Add disconnect functionality
- [ ] Show last sync timestamp

### 4. Sync Features
- [ ] Add manual sync button
- [ ] Show sync status/loading states
- [ ] Display sync results/errors
- [ ] Auto-refresh connection status

### 5. Error Handling
- [ ] Display validation errors from API
- [ ] Show user-friendly error messages
- [ ] Handle network errors
- [ ] Add retry logic for failed requests

## Example Code

### Store JWT Token
```javascript
// After login
const response = await fetch('http://localhost:3000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});

const data = await response.json();
if (data.token) {
  sessionStorage.setItem('jwt_token', data.token);
}
```

### Make Authenticated Request
```javascript
const token = sessionStorage.getItem('jwt_token');

const response = await fetch('http://localhost:3000/connections/status', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

if (response.status === 401) {
  // Token expired, redirect to login
  window.location.href = '/login.html';
}

const connections = await response.json();
```

### Handle Errors
```javascript
try {
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }
  
  const data = await response.json();
  return data;
} catch (error) {
  console.error('API Error:', error);
  alert(`Error: ${error.message}`);
}
```
```

### 3. Testing Instructions for Frontend

```markdown
# Frontend Testing Guide

## Setup Backend for Testing

1. Start mock Prokip API:
   ```bash
   cd backend
   node tests/mock-prokip-api.js
   ```

2. Start backend server:
   ```bash
   cd backend
   npm start
   ```

3. Backend will be available at: `http://localhost:3000`

## Test Scenarios

### Scenario 1: User Registration & Login
1. Go to login page
2. Register new user
3. Login with credentials
4. Verify token is stored
5. Verify protected pages are accessible

### Scenario 2: Connect Stores
1. Login first
2. Configure Prokip credentials
3. Connect WooCommerce store
4. Verify connection appears in list
5. Check last sync timestamp

### Scenario 3: Manual Sync
1. Click sync button
2. Verify loading state shows
3. Check for success message
4. Verify timestamp updates

## Test Credentials

**Mock Prokip API:**
- Token: `mock_prokip_token_123`
- Location: `LOC001`

**Test User:**
- Username: `admin`
- Password: `test123`
```

---

## Summary Checklist

### For You (Backend Developer):

- [ ] Test real Prokip API endpoints
- [ ] Document all request/response formats
- [ ] Save response samples as JSON files
- [ ] Update mock API to match real API
- [ ] Update integration code to match real API
- [ ] Test locally with mock API
- [ ] Switch to live API
- [ ] Create API documentation for frontend
- [ ] Share testing guide with frontend dev

### For Frontend Developer:

- [ ] Update API base URL
- [ ] Implement JWT authentication
- [ ] Update all API calls to match backend
- [ ] Add error handling
- [ ] Test with backend server
- [ ] Implement new features based on API capabilities

---

## Next Steps

1. **Today**: Test real Prokip API and document responses
2. **Day 2**: Update mock API and integration code
3. **Day 3**: Test locally with mock API
4. **Day 4**: Switch to live API and test
5. **Day 5**: Share docs with frontend dev and support integration
