# Prokip E-commerce Integration System

## Project Overview

A **production-ready** e-commerce integration platform that connects **Shopify** and **WooCommerce** stores with the **Prokip** inventory management system. Features real-time bidirectional synchronization, OAuth authentication, and a modern web-based dashboard.

Built with **Node.js**, **Express.js**, **Prisma ORM**, and **PostgreSQL** for enterprise-grade reliability and scalability.

---

## ✨ Key Features

### 🔌 Multi-Platform Integration
- **Shopify**: Full OAuth 2.0 integration with automatic webhook registration
- **WooCommerce**: REST API v3 with Consumer Key/Secret or Application Password authentication
- **Multiple Stores**: Connect unlimited stores from both platforms simultaneously
- **Platform Agnostic**: Each store operates independently with unified inventory

### 🔄 Real-Time Synchronization
- **Bidirectional Sync**: 
  - Prokip inventory → Push to all connected stores
  - Store products → Display alongside Prokip data
- **Webhook-Driven**: Instant updates via platform webhooks (products, inventory)
- **Manual Sync**: On-demand inventory synchronization from dashboard
- **Inventory Tracking**: Automatic enabling of Shopify inventory tracking

### 🎨 Modern Web Dashboard
- **Prokip-Themed UI**: Professional interface matching Prokip's branding
- **Prokip Login**: Authenticate with your Prokip username/password
- **Business Location Selection**: Choose which Prokip location to sync
- **Connected Store Management**: View and manage all connected stores
- **Prokip Operations**: View products, sales, and purchases from Prokip
- **Store Analytics**: View orders, products, and sync status per store
- **Smart Notifications**: Success/error messages with auto-dismiss

### 🔐 Security & Authentication
- **Prokip OAuth**: Login with Prokip credentials (username/password)
- **Token Management**: Automatic token refresh when expired
- **OAuth 2.0**: Industry-standard Shopify app installation
- **Encrypted Credentials**: Secure storage of API keys and tokens
- **CSRF Protection**: State parameter validation in OAuth flow

### 📊 Data Management
- **PostgreSQL Database**: ACID-compliant data persistence
- **Prisma ORM**: Type-safe database queries with automated migrations
- **Inventory Logging**: Track all inventory sync operations
- **Sales Logging**: Complete audit trail of all transactions
- **Webhook Events**: Log all incoming webhook payloads

---

## 🏗️ Tech Stack

### Backend
- **Runtime**: Node.js v16+
- **Framework**: Express.js 4.18+
- **Database**: PostgreSQL 12+
- **ORM**: Prisma 5.22+
- **Authentication**: JWT (jsonwebtoken) + bcryptjs
- **HTTP Client**: Axios
- **Validation**: express-validator

### Frontend
- **UI**: HTML5, CSS3, Modern JavaScript (ES6+)
- **Design**: Responsive CSS Grid/Flexbox
- **Icons**: Font Awesome 6
- **API**: Native Fetch API
- **Storage**: LocalStorage for auth state

### External APIs
- **Shopify**: Admin REST API 2026-01 + OAuth 2.0
- **WooCommerce**: REST API v3
- **Prokip**: REST API at `https://api.prokip.africa`

---

## 📋 Database Schema

```prisma
model User {
  id        Int      @id @default(autoincrement())
  username  String   @unique
  password  String   // bcrypt hashed
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  connections Connection[]
}

model Connection {
  id              Int      @id @default(autoincrement())
  userId          Int
  platform        String   // 'shopify' or 'woocommerce'
  storeUrl        String
  storeName       String?
  accessToken     String?  // Shopify OAuth token
  consumerKey     String?  // WooCommerce key (encrypted)
  consumerSecret  String?  // WooCommerce secret (encrypted)
  wooUsername     String?  // WooCommerce Application Password username
  wooAppPassword  String?  // WooCommerce Application Password
  lastSync        DateTime @default(now())
  syncEnabled     Boolean  @default(true)
  
  user            User @relation(...)
  inventoryLogs   InventoryLog[]
  salesLogs       SalesLog[]
  webhookEvents   WebhookEvent[]
  
  @@unique([userId, platform, storeUrl])
}

model InventoryLog {
  id           Int      @id @default(autoincrement())
  connectionId Int
  productId    String
  productName  String
  sku          String?
  quantity     Int
  price        Float
  lastSynced   DateTime @default(now())
  
  @@unique([connectionId, sku])
}

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
}

model WebhookEvent {
  id           Int       @id @default(autoincrement())
  connectionId Int
  eventType    String
  payload      String    // JSON
  processed    Boolean   @default(false)
  errorMessage String?
  createdAt    DateTime  @default(now())
  processedAt  DateTime?
}

model ProkipConfig {
  id           Int       @id @default(1)
  token        String
  refreshToken String?
  expiresAt    DateTime?
  apiUrl       String
  locationId   String
  userId       Int       @default(1)
}
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v16 or higher
- PostgreSQL 12 or higher
- Shopify Partner account (for Shopify integration)
- WooCommerce store with REST API enabled (for WooCommerce integration)
- Prokip account with API access

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd prokip-ecommerce-integration
```

2. **Install dependencies**
```bash
cd backend
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your settings
```

4. **Setup database**
```bash
npx prisma generate
npx prisma migrate dev
```

5. **Start the server**
```bash
npm start
```

6. **Access the dashboard**
```
http://localhost:3000
```

---

## 📁 Project Structure

```
prokip-ecommerce-integration/
├── README.md                    # This file
├── SETUP.md                     # Detailed setup instructions
├── TESTING_GUIDE.md             # Testing documentation
├── IMPLEMENTATION_GUIDE.md      # Technical implementation details
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── app.js               # Express application entry
│   │   ├── routes/
│   │   │   ├── authRoutes.js    # Prokip authentication
│   │   │   ├── connectionRoutes.js  # Store connections
│   │   │   ├── prokipRoutes.js  # Prokip API operations
│   │   │   ├── storeRoutes.js   # Store data endpoints
│   │   │   ├── syncRoutes.js    # Sync operations
│   │   │   ├── setupRoutes.js   # Product setup
│   │   │   └── webhookRoutes.js # Webhook handlers
│   │   ├── services/
│   │   │   ├── prokipService.js # Prokip API integration
│   │   │   ├── shopifyService.js # Shopify API integration
│   │   │   ├── wooService.js    # WooCommerce integration
│   │   │   ├── storeService.js  # Store operations
│   │   │   └── syncService.js   # Sync logic
│   │   └── middlewares/
│   │       └── authMiddleware.js
│   ├── prisma/
│   │   ├── schema.prisma        # Database schema
│   │   └── migrations/          # Migration history
│   ├── lib/
│   │   ├── prisma.js            # Prisma client
│   │   └── validation.js        # Input validators
│   └── tests/
│       ├── mock-prokip-api.js   # Mock Prokip server
│       └── Postman-Collection.json
└── frontend/
    └── public/
        ├── index.html           # Main dashboard
        ├── script.js            # Frontend logic
        └── styles.css           # Styling
```

---

## 🔧 Environment Variables

```dotenv
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/prokip_integration

# Server
PORT=3000
NODE_ENV=development

# Prokip API
PROKIP_API=https://api.prokip.africa

# Shopify OAuth
SHOPIFY_CLIENT_ID=your_shopify_client_id
SHOPIFY_CLIENT_SECRET=your_shopify_client_secret
SHOPIFY_SCOPES=read_products,write_products,read_inventory,write_inventory,read_locations,read_orders
REDIRECT_URI=https://your-domain.com/connections/callback/shopify

# WooCommerce (optional - for OAuth method)
WOOCOMMERCE_CLIENT_ID=your_woo_client_id
WOOCOMMERCE_CLIENT_SECRET=your_woo_client_secret

# Mock Mode (for testing)
MOCK_PROKIP=false
MOCK_SHOPIFY=false
MOCK_WOO=false
```

---

## 📖 Documentation

- [Setup Guide](SETUP.md) - Detailed installation and configuration
- [Testing Guide](TESTING_GUIDE.md) - How to test the integration
- [Implementation Guide](IMPLEMENTATION_GUIDE.md) - Technical architecture details

---

## 🔌 API Endpoints

### Authentication
- `POST /auth/prokip-login` - Login with Prokip credentials
- `POST /auth/prokip-location` - Select business location
- `GET /auth/prokip-locations` - Get available locations
- `POST /auth/prokip-logout` - Logout

### Connections
- `POST /connections/shopify/initiate` - Start Shopify OAuth
- `GET /connections/callback/shopify` - Shopify OAuth callback
- `POST /connections/woocommerce/connect` - Connect WooCommerce store
- `GET /connections` - List all connections
- `DELETE /connections/:id` - Remove connection

### Prokip Operations
- `GET /prokip/products` - Get Prokip products
- `GET /prokip/inventory` - Get Prokip inventory
- `GET /prokip/sales` - Get Prokip sales
- `GET /prokip/purchases` - Get Prokip purchases

### Store Operations
- `GET /stores/:id/products` - Get store products
- `GET /stores/:id/orders` - Get store orders
- `GET /stores/:id/sales` - Get store sales

### Sync
- `GET /sync/status` - Get sync status
- `POST /sync/inventory` - Sync inventory from Prokip to stores

---

## 📄 License

MIT License - see LICENSE file for details.
