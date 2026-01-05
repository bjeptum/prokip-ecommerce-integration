# Implementation Guide - Backend Architecture

## Overview

This guide covers the backend implementation of the Prokip E-commerce Integration system, including architecture, API endpoints, services, and integration patterns.

---

## Architecture

### Technology Stack

```
┌─────────────────────────────────────────────────┐
│              Frontend Dashboard                  │
│         (HTML/CSS/JavaScript)                    │
└──────────────────┬──────────────────────────────┘
                   │ HTTPS/JWT
                   ▼
┌─────────────────────────────────────────────────┐
│           Express.js Backend                     │
│   ┌───────────┐  ┌──────────┐  ┌─────────────┐ │
│   │   Routes  │  │ Services │  │ Middlewares │ │
│   └───────────┘  └──────────┘  └─────────────┘ │
└──────────────────┬──────────────────────────────┘
                   │ Prisma ORM
                   ▼
┌─────────────────────────────────────────────────┐
│         PostgreSQL Database                      │
│   User | Connection | InventoryCache             │
│   SalesLog | ProkipConfig                        │
└─────────────────────────────────────────────────┘
         │               │               │
         ▼               ▼               ▼
┌──────────────┐ ┌────────────┐ ┌──────────────┐
│ Shopify API  │ │ WooCommerce│ │  Prokip API  │
│   (OAuth)    │ │   (REST)   │ │   (Bearer)   │
└──────────────┘ └────────────┘ └──────────────┘
```

### Project Structure

```
backend/
├── src/
│   ├── app.js                  # Express application entry point
│   ├── routes/
│   │   ├── authRoutes.js       # Login/register endpoints
│   │   ├── connectionRoutes.js # Store connection management
│   │   ├── setupRoutes.js      # Product setup and mapping
│   │   ├── syncRoutes.js       # Sync control and status
│   │   └── webhookRoutes.js    # Webhook receivers
│   ├── services/
│   │   ├── shopifyService.js   # Shopify API integration
│   │   ├── wooService.js       # WooCommerce API integration
│   │   ├── prokipMapper.js     # Prokip API integration
│   │   ├── storeService.js     # Store operations
│   │   └── syncService.js      # Sync logic
│   └── middlewares/
│       └── authMiddleware.js   # JWT validation
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Migration history
├── tests/
│   └── mock-servers.js         # Mock API servers
├── lib/
│   ├── prisma.js               # Prisma client instance
│   └── validation.js           # Input validators
├── .env                        # Environment configuration
└── package.json                # Dependencies
```

---

## Database Schema

### User Table
Stores authentication credentials for dashboard access.

```prisma
model User {
  id       Int    @id @default(autoincrement())
  username String @unique
  password String  // bcrypt hashed
}
```

**Usage:**
- Login to dashboard
- API authentication via JWT

### Connection Table
Stores e-commerce store connections with platform-specific credentials.

```prisma
model Connection {
  id             Int              @id @default(autoincrement())
  platform       String           // 'shopify' or 'woocommerce'
  storeUrl       String
  accessToken    String?          // Shopify OAuth token
  consumerKey    String?          // WooCommerce key
  consumerSecret String?          // WooCommerce secret
  lastSync       DateTime?
  syncEnabled    Boolean          @default(true)
  InventoryCache InventoryCache[]
  SalesLog       SalesLog[]
  
  @@unique([platform, storeUrl])  // Allow same URL for different platforms
}
```

**Relationships:**
- One connection → Many inventory cache entries
- One connection → Many sales logs

### InventoryCache Table
Tracks SKU-level inventory for each connected store.

```prisma
model InventoryCache {
  id           Int        @id @default(autoincrement())
  connectionId Int
  sku          String
  quantity     Int
  connection   Connection @relation(fields: [connectionId], references: [id])
}
```

**Purpose:**
- Store inventory snapshots
- Compare with Prokip inventory
- Determine what needs syncing

### SalesLog Table
Audit trail of all sales processed from stores.

```prisma
model SalesLog {
  id           Int        @id @default(autoincrement())
  connectionId Int
  orderId      String     // Store's order ID
  prokipSellId String?    // Prokip's sale ID
  timestamp    DateTime   @default(now())
  connection   Connection @relation(fields: [connectionId], references: [id])
}
```

**Purpose:**
- Track processed orders
- Prevent duplicate sales
- Audit trail

### ProkipConfig Table
Stores Prokip API credentials (singleton pattern).

```prisma
model ProkipConfig {
  id         Int    @id @default(1)
  token      String
  apiUrl     String
  locationId String
}
```

**Purpose:**
- Central Prokip API configuration
- Used by all sync operations

---

## API Endpoints

### Authentication Routes
**Base:** `/auth`

#### POST /auth/register
Create new user account.

**Request:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "User registered successfully"
}
```

#### POST /auth/login
Authenticate and receive JWT token.

**Request:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin"
  }
}
```

---

### Connection Routes
**Base:** `/connections`

#### POST /connections/shopify/initiate
Start Shopify OAuth flow.

**Request:**
```json
{
  "storeUrl": "mystore"  // or "mystore.myshopify.com"
}
```

**Response:**
```json
{
  "authUrl": "https://mystore.myshopify.com/admin/oauth/authorize?client_id=..."
}
```

**Frontend Action:** Redirect user to `authUrl`

#### GET /connections/callback/shopify
OAuth callback endpoint (Shopify redirects here).

**Query Parameters:**
- `code` - Authorization code from Shopify
- `shop` - Store domain
- `error` - Error code (if user cancelled)
- `error_description` - Error details

**Success:** Redirects to `/?shopify_success=true&store={shop}`
**Error:** Redirects to `/?shopify_error={message}`

#### POST /connections/woocommerce
Connect WooCommerce store.

**Request:**
```json
{
  "storeUrl": "https://mystore.com",
  "consumerKey": "ck_...",
  "consumerSecret": "cs_..."
}
```

**Response:**
```json
{
  "success": true
}
```

#### POST /connections/prokip
Configure Prokip API credentials.

**Request:**
```json
{
  "token": "Bearer xyz...",
  "locationId": "1"
}
```

**Response:**
```json
{
  "success": true
}
```

#### DELETE /connections/:id
Disconnect a store.

**Response:**
```json
{
  "success": true
}
```

---

### Sync Routes
**Base:** `/sync`

#### GET /sync/status
Get all connections with sync status.

**Response:**
```json
[
  {
    "id": 1,
    "platform": "shopify",
    "storeUrl": "mystore.myshopify.com",
    "lastSync": "2026-01-05T10:30:00.000Z",
    "syncEnabled": true,
    "productCount": 45,
    "orderCount": 123
  }
]
```

#### POST /sync
Trigger manual sync for all stores.

**Response:**
```json
{
  "message": "Sync initiated for all stores"
}
```

#### POST /sync/pull-orders
Pull recent orders from stores to Prokip.

**Response:**
```json
{
  "message": "Orders pulled successfully",
  "count": 5
}
```

#### POST /sync/pause
Pause automatic syncing.

#### POST /sync/resume
Resume automatic syncing.

---

### Webhook Routes
**Base:** `/connections/webhook`

#### POST /connections/webhook/shopify
Receive webhooks from Shopify.

**Headers:**
- `X-Shopify-Topic` - Event type (e.g., "orders/create")
- `X-Shopify-Shop-Domain` - Store domain
- `X-Shopify-Hmac-Sha256` - HMAC signature for verification

**Body:** Raw JSON from Shopify

**Supported Topics:**
- `orders/create` - New order created
- `orders/updated` - Order modified
- `orders/cancelled` - Order cancelled
- `products/update` - Product changed

#### POST /connections/webhook/woocommerce
Receive webhooks from WooCommerce.

**Body:**
```json
{
  "topic": "order.created",
  "resource": {
    // WooCommerce order data
  }
}
```

---

## Services

### shopifyService.js
Handles all Shopify API interactions.

**Key Functions:**

```javascript
// Register webhooks for a store
async function registerShopifyWebhooks(shop, accessToken)

// Get all products from Shopify
async function getShopifyProducts(shop, accessToken)

// Create product in Shopify
async function createShopifyProduct(shop, accessToken, product)

// Update inventory quantity
async function updateShopifyInventory(shop, accessToken, inventoryItemId, locationId, quantity)

// Get store locations
async function getShopifyLocations(shop, accessToken)
```

**API Version:** 2026-01
**Base URL Pattern:** `https://{shop}/admin/api/2026-01/`

### wooService.js
Handles WooCommerce REST API integration.

**Key Functions:**

```javascript
// Register webhooks
async function registerWooWebhooks(storeUrl, consumerKey, consumerSecret)

// Get products
async function getWooProducts(storeUrl, consumerKey, consumerSecret)

// Create product
async function createWooProduct(storeUrl, consumerKey, consumerSecret, product)

// Update inventory
async function updateWooInventory(storeUrl, consumerKey, consumerSecret, productId, quantity)
```

**Authentication:** Basic Auth (Base64 encoded `key:secret`)
**Base URL Pattern:** `{storeUrl}/wp-json/wc/v3/`

### prokipMapper.js
Integrates with Prokip API.

**Key Functions:**

```javascript
// Get products from Prokip
async function getProkipProducts(locationId)

// Record sale in Prokip
async function sendSaleToProkip(saleData)

// Update Prokip inventory
async function updateProkipInventory(sku, quantity, locationId)
```

**Authentication:** Bearer token
**Base URL:** `https://api.prokip.africa`

### syncService.js
Core synchronization logic.

**Key Function:**

```javascript
async function processStoreToProkip(storeUrl, topic, data, platform)
```

**Flow:**
1. Receive webhook from store
2. Parse order data
3. Extract SKU and quantity
4. Check if order already processed (SalesLog)
5. Send sale to Prokip
6. Update inventory cache
7. Log transaction

---

## Background Jobs

### Inventory Sync Cron Job

**Schedule:** Every 5 minutes
**Implementation:** node-cron

```javascript
cron.schedule('*/5 * * * *', async () => {
  // 1. Get Prokip products and inventory
  const prokipProducts = await getProkipProducts(locationId);
  
  // 2. Get all active connections
  const connections = await prisma.connection.findMany({
    where: { syncEnabled: true }
  });
  
  // 3. For each connection
  for (const conn of connections) {
    // 4. Compare Prokip inventory with store inventory
    // 5. Push updates to store if differences found
  }
});
```

---

## Authentication & Security

### JWT Middleware

```javascript
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

**Protected Routes:**
- All `/connections/*` endpoints
- All `/sync/*` endpoints
- All `/setup/*` endpoints

### Password Hashing

```javascript
const hashedPassword = await bcrypt.hash(password, 10);
const isMatch = await bcrypt.compare(inputPassword, storedHash);
```

---

## Error Handling

### OAuth Errors

```javascript
// User cancels authorization
/?shopify_error=access_denied

// Invalid credentials
/?shopify_error=Failed to exchange authorization code

// Store already connected
// Updates existing connection instead of failing
```

### API Errors

```javascript
{
  "error": "Error message",
  "details": "Additional context"
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad request / validation error
- `401` - Unauthorized
- `500` - Server error

---

## Environment Variables

Required configuration in `.env`:

```dotenv
# Database
DATABASE_URL=postgresql://...

# Server
PORT=3000
NODE_ENV=development

# Shopify
SHOPIFY_CLIENT_ID=api_key
SHOPIFY_CLIENT_SECRET=api_secret
REDIRECT_URI=https://prokip.local/connections/callback/shopify
WEBHOOK_URL=https://prokip.local/connections/webhook/shopify

# Prokip
PROKIP_API=https://api.prokip.africa

# Security
JWT_SECRET=random_secret_string
```

---

## Testing

### Mock Mode

Set `MOCK_MODE=true` to use local mock servers instead of real APIs.

**Mock Servers:**
- Prokip: `http://localhost:4000`
- Shopify: `http://localhost:4001`
- WooCommerce: `http://localhost:4002`

See [MOCK_SERVER_TESTING.md](MOCK_SERVER_TESTING.md) for details.

---

## Performance Considerations

### Database Indexing
- `User.username` - Unique index for fast login
- `Connection.[platform, storeUrl]` - Composite unique index
- Foreign key indexes automatically created by Prisma

### Connection Pooling
Prisma manages connection pool automatically:
- Default pool size: 10
- Can be configured via DATABASE_URL parameters

### Caching Strategy
- `InventoryCache` table stores last known inventory
- Reduces API calls to Prokip
- Only sync differences

---

## Deployment

### Production Checklist
- [ ] Set strong `JWT_SECRET`
- [ ] Use environment-specific DATABASE_URL
- [ ] Configure HTTPS reverse proxy
- [ ] Update redirect URIs
- [ ] Enable PostgreSQL SSL
- [ ] Set up process manager (PM2)
- [ ] Configure log rotation
- [ ] Set up monitoring
- [ ] Test webhook delivery

---

**For frontend implementation details, see [FRONTEND_IMPLEMENTATION_GUIDE.md](FRONTEND_IMPLEMENTATION_GUIDE.md)**
