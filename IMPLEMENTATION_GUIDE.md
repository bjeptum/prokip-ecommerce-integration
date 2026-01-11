# Implementation Guide - Backend Architecture

## Overview

This guide covers the backend implementation of the Prokip E-commerce Integration system, including architecture, API endpoints, services, and integration patterns.

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────┐
│              Frontend Dashboard                  │
│         (HTML/CSS/JavaScript)                    │
└──────────────────┬──────────────────────────────┘
                   │ HTTP/REST
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
│   users | connections | inventory_logs           │
│   sales_logs | webhook_events | prokip_config    │
└─────────────────────────────────────────────────┘
         │               │               │
         ▼               ▼               ▼
┌──────────────┐ ┌────────────┐ ┌──────────────┐
│ Shopify API  │ │ WooCommerce│ │  Prokip API  │
│   (OAuth)    │ │   (REST)   │ │   (OAuth)    │
└──────────────┘ └────────────┘ └──────────────┘
```

### Project Structure

```
backend/
├── src/
│   ├── app.js                      # Express application entry point
│   ├── routes/
│   │   ├── authRoutes.js           # Prokip authentication endpoints
│   │   ├── connectionRoutes.js     # Store connection management
│   │   ├── prokipRoutes.js         # Prokip API operations
│   │   ├── storeRoutes.js          # Store data endpoints
│   │   ├── syncRoutes.js           # Sync control and operations
│   │   ├── setupRoutes.js          # Product setup and mapping
│   │   └── webhookRoutes.js        # Webhook receivers
│   ├── services/
│   │   ├── prokipService.js        # Prokip API integration
│   │   ├── shopifyService.js       # Shopify API integration
│   │   ├── wooService.js           # WooCommerce API integration
│   │   ├── wooAppPasswordService.js # WooCommerce App Password auth
│   │   ├── storeService.js         # Store operations
│   │   └── syncService.js          # Sync logic
│   └── middlewares/
│       └── authMiddleware.js       # JWT validation
├── prisma/
│   ├── schema.prisma               # Database schema
│   └── migrations/                 # Migration history
├── lib/
│   ├── prisma.js                   # Prisma client instance
│   └── validation.js               # Input validators
├── tests/
│   ├── mock-prokip-api.js          # Mock Prokip server
│   └── Postman-Collection.json     # API test collection
├── .env                            # Environment configuration
└── package.json                    # Dependencies
```

---

## Database Schema

### User Table
Stores user accounts (currently used for basic auth, Prokip login is separate).

```prisma
model User {
  id        Int      @id @default(autoincrement())
  username  String   @unique
  password  String   // bcrypt hashed
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  connections Connection[]
}
```

### Connection Table
Stores e-commerce store connections with platform-specific credentials.

```prisma
model Connection {
  id              Int      @id @default(autoincrement())
  userId          Int
  platform        String   // 'shopify' or 'woocommerce'
  storeUrl        String
  storeName       String?
  
  // Shopify OAuth
  accessToken     String?
  accessTokenSecret String?
  
  // WooCommerce API Keys (encrypted)
  consumerKey     String?
  consumerSecret  String?
  
  // WooCommerce Application Password
  wooUsername     String?
  wooAppPassword  String?
  
  // OAuth fields
  oauthToken      String?
  oauthSecret     String?
  
  lastSync        DateTime @default(now())
  syncEnabled     Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  user            User @relation(fields: [userId], references: [id])
  inventoryLogs   InventoryLog[]
  salesLogs       SalesLog[]
  webhookEvents   WebhookEvent[]
  
  @@unique([userId, platform, storeUrl])
}
```

### InventoryLog Table
Tracks inventory sync operations per SKU.

```prisma
model InventoryLog {
  id           Int      @id @default(autoincrement())
  connectionId Int
  productId    String
  productName  String
  sku          String?
  quantity     Int
  price        Float
  lastSynced   DateTime @default(now())
  
  connection   Connection @relation(...)
  
  @@unique([connectionId, sku])
}
```

### SalesLog Table
Audit trail of sales processed from stores.

```prisma
model SalesLog {
  id            Int      @id @default(autoincrement())
  connectionId  Int
  orderId       String
  orderNumber   String?
  customerName  String?
  customerEmail String?
  totalAmount   Float
  status        String?
  orderDate     DateTime
  syncedAt      DateTime @default(now())
  
  connection    Connection @relation(...)
}
```

### WebhookEvent Table
Logs all incoming webhooks for debugging and replay.

```prisma
model WebhookEvent {
  id           Int       @id @default(autoincrement())
  connectionId Int
  eventType    String    // 'products/update', 'inventory_levels/update', etc.
  payload      String    // JSON string
  processed    Boolean   @default(false)
  errorMessage String?
  createdAt    DateTime  @default(now())
  processedAt  DateTime?
  
  connection   Connection @relation(...)
}
```

### ProkipConfig Table
Stores Prokip authentication and configuration.

```prisma
model ProkipConfig {
  id           Int       @id @default(1)
  token        String    // Access token
  refreshToken String?   // Refresh token
  expiresAt    DateTime? // Token expiry
  apiUrl       String    // API base URL
  locationId   String    // Selected business location
  userId       Int       @default(1)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}
```

---

## API Routes

### Authentication Routes (`authRoutes.js`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/prokip-login` | Authenticate with Prokip credentials |
| POST | `/auth/prokip-location` | Set active business location |
| GET | `/auth/prokip-locations` | Get user's business locations |
| POST | `/auth/prokip-logout` | Clear Prokip authentication |
| GET | `/auth/prokip-status` | Check authentication status |

**Login Flow:**
1. User submits username/password
2. Backend calls Prokip OAuth token endpoint
3. Token stored in `prokip_config`
4. User selects business location
5. Location ID stored, dashboard accessible

### Connection Routes (`connectionRoutes.js`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/connections` | List all store connections |
| DELETE | `/connections/:id` | Remove a connection |
| POST | `/connections/shopify/initiate` | Start Shopify OAuth flow |
| GET | `/connections/callback/shopify` | Shopify OAuth callback |
| POST | `/connections/woocommerce/connect` | Connect WooCommerce with App Password |

**Shopify OAuth Flow:**
1. Frontend calls `/connections/shopify/initiate` with store URL
2. Backend returns authorization URL
3. User authorizes in Shopify
4. Shopify redirects to callback with auth code
5. Backend exchanges code for access token
6. Connection created, webhooks registered

**WooCommerce Connection:**
1. User provides store URL, username, app password
2. Backend validates credentials with test API call
3. Connection created with credentials stored

### Prokip Routes (`prokipRoutes.js`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/prokip/products` | Get products from Prokip |
| GET | `/prokip/inventory` | Get inventory levels |
| GET | `/prokip/sales` | Get sales records |
| GET | `/prokip/purchases` | Get purchase records |
| POST | `/prokip/products` | Create product in Prokip |
| POST | `/prokip/sales` | Record sale in Prokip |
| POST | `/prokip/purchases` | Record purchase in Prokip |

### Store Routes (`storeRoutes.js`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stores/:id/products` | Get products from connected store |
| GET | `/stores/:id/orders` | Get orders from connected store |
| GET | `/stores/:id/sales` | Get sales data from store |

### Sync Routes (`syncRoutes.js`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sync/status` | Get overall sync status |
| POST | `/sync/inventory` | Sync Prokip inventory to store |
| POST | `/sync/products` | Sync products between systems |

**Inventory Sync Process:**
1. Get products from Prokip
2. Get inventory levels from Prokip
3. For each product with SKU:
   - Find matching product in connected store
   - Update inventory quantity
   - Enable inventory tracking if needed (Shopify)
   - Log sync operation

---

## Services

### prokipService.js

Handles all Prokip API interactions with OAuth token management.

**Key Functions:**

```javascript
// Authentication
authenticateUser(username, password) // Login with Prokip credentials
refreshAccessToken(refreshToken)      // Refresh expired token
saveProkipConfig(data, userId)        // Store token in database
getValidToken()                       // Get valid token, refresh if needed
getAuthHeaders()                      // Get headers with Bearer token

// Business Operations
getBusinessLocations()                // Get user's business locations
getProducts()                         // Get all products
getInventory()                        // Get inventory report
getSales(locationId, startDate, endDate)      // Get sales
getPurchases(locationId, startDate, endDate)  // Get purchases

// CRUD Operations
createProduct(productData)            // Create new product
recordSale(saleData)                  // Record a sale
recordPurchase(purchaseData)          // Record a purchase
```

### shopifyService.js

Handles Shopify Admin API interactions.

**Key Functions:**

```javascript
// Products
getShopifyProducts(shop, accessToken)
createShopifyProduct(shop, accessToken, product)

// Inventory
getShopifyLocations(shop, accessToken)
updateShopifyInventory(shop, accessToken, inventoryItemId, locationId, quantity)
enableInventoryTracking(shop, accessToken, inventoryItemId)

// Orders
getShopifyOrders(shop, accessToken, limit)

// Webhooks
registerShopifyWebhooks(shop, accessToken)
cleanupExistingWebhooks(shop, accessToken, webhookUrl)
```

**Registered Webhooks:**
- `products/update` - Product changes
- `products/create` - New products
- `inventory_levels/update` - Inventory changes

**Note:** Order webhooks (`orders/create`, `orders/paid`, etc.) require Protected Customer Data access from Shopify.

### storeService.js

Unified interface for store operations across platforms.

**Key Functions:**

```javascript
createProductInStore(connection, product)
updateInventoryInStore(connection, sku, quantity)
verifyWooCommerceConnection(storeUrl, username, appPassword)
```

### wooAppPasswordService.js

WooCommerce Application Password authentication.

**Key Functions:**

```javascript
createAuthenticatedClient(storeUrl, username, appPassword)
getProducts(client)
updateProduct(client, productId, data)
getOrders(client, params)
```

---

## Environment Variables

```dotenv
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/prokip_integration

# Server
PORT=3000
NODE_ENV=development

# Prokip API
PROKIP_API=https://api.prokip.africa

# Shopify OAuth
SHOPIFY_CLIENT_ID=your_client_id
SHOPIFY_CLIENT_SECRET=your_client_secret
SHOPIFY_SCOPES=read_products,write_products,read_inventory,write_inventory,read_locations,read_orders
REDIRECT_URI=https://your-domain.com/connections/callback/shopify
WEBHOOK_URL=https://your-domain.com/connections/webhook/shopify

# WooCommerce OAuth (optional)
WOOCOMMERCE_CLIENT_ID=
WOOCOMMERCE_CLIENT_SECRET=

# Mock Mode
MOCK_PROKIP=false
MOCK_SHOPIFY=false
MOCK_WOO=false
MOCK_PROKIP_URL=http://localhost:4000
MOCK_SHOPIFY_URL=http://localhost:4001
```

---

## Error Handling

### Standard Error Response

```json
{
  "error": "Error message",
  "details": "Additional details (optional)"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid/missing token) |
| 404 | Resource not found |
| 500 | Server error |

### Common Errors

**Prokip Authentication:**
- `Authentication failed` - Wrong username/password
- `Session expired` - Token expired, need to re-login

**Shopify:**
- `read_locations scope not approved` - Need to add scope in Shopify app
- `Inventory item does not have inventory tracking enabled` - Auto-fixed by system
- `OAuth code already used` - Duplicate callback, handled by system

**WooCommerce:**
- `Invalid credentials` - Wrong username or app password
- `REST API disabled` - Enable in WooCommerce settings

---

## Webhook Processing

### Shopify Webhooks

```javascript
router.post('/webhook/shopify', (req, res) => {
  // Verify HMAC signature
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const topic = req.headers['x-shopify-topic'];
  const shop = req.headers['x-shopify-shop-domain'];
  
  // Validate signature
  const generatedHmac = crypto.createHmac('sha256', SHOPIFY_CLIENT_SECRET)
    .update(req.body)
    .digest('base64');
  
  if (generatedHmac !== hmac) {
    return res.status(401).send('Invalid HMAC');
  }
  
  // Process webhook
  processWebhook(shop, topic, JSON.parse(req.body));
  
  res.status(200).send('OK');
});
```

### WooCommerce Webhooks

```javascript
router.post('/webhook/woocommerce', (req, res) => {
  const secret = req.headers['x-wc-webhook-signature'];
  const topic = req.headers['x-wc-webhook-topic'];
  const source = req.headers['x-wc-webhook-source'];
  
  // Validate and process
  processWebhook(source, topic, req.body);
  
  res.status(200).send('OK');
});
```

---

## Security Considerations

1. **Token Storage**: Prokip tokens stored encrypted in database
2. **OAuth State**: Random state parameter prevents CSRF
3. **Webhook Verification**: HMAC signature validation
4. **Credential Encryption**: WooCommerce API keys encrypted
5. **Input Validation**: express-validator on all endpoints
6. **SQL Injection**: Prisma ORM prevents SQL injection

---

## Performance Optimizations

1. **Connection Pooling**: Prisma manages database connections
2. **Duplicate Prevention**: OAuth codes tracked to prevent double-processing
3. **Batch Operations**: Inventory sync processes products in sequence
4. **Error Isolation**: Failed syncs don't block other products
5. **Logging**: Minimal logging in production mode
