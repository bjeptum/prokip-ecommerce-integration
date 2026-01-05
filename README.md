# Prokip E-commerce Integration System

## Project Overview
A **production-ready** e-commerce integration platform that connects **Shopify** and **WooCommerce** stores with the Prokip inventory management system. Features real-time bidirectional synchronization, OAuth authentication, and a modern web-based dashboard.

Built with **Node.js**, **Express.js**, **Prisma ORM**, and **PostgreSQL** for enterprise-grade reliability and scalability.

---

## ✨ Key Features

### 🔌 Multi-Platform Integration
- **Shopify**: Full OAuth 2.0 integration with automatic webhook registration
- **WooCommerce**: REST API v3 with Consumer Key/Secret authentication
- **Multiple Stores**: Connect unlimited stores from both platforms simultaneously
- **Platform Agnostic**: Each store operates independently with unified inventory

### 🔄 Real-Time Synchronization
- **Bidirectional Sync**: 
  - Orders from stores → Update Prokip inventory
  - Prokip inventory changes → Push to all connected stores
- **Webhook-Driven**: Instant order processing via platform webhooks
- **Background Jobs**: Automated inventory sync every 5 minutes
- **Manual Sync**: On-demand synchronization from dashboard

### 🎨 Modern Web Dashboard
- **Prokip-Themed UI**: Professional interface matching Prokip's branding
- **Dashboard Analytics**: View connected stores, synced products, and order counts
- **Module Settings**: Sidebar access to connection management
- **One-Click OAuth**: Streamlined Shopify connection via standard OAuth flow
- **Loading States**: Visual feedback during API operations
- **Smart Notifications**: Success/error messages with auto-dismiss

### 🔐 Security & Authentication
- **JWT Authentication**: Secure API access with token-based auth
- **User Management**: Login system for dashboard access
- **OAuth 2.0**: Industry-standard Shopify app installation
- **Encrypted Credentials**: Secure storage of API keys and tokens
- **CSRF Protection**: State parameter validation in OAuth flow

### 📊 Data Management
- **PostgreSQL Database**: ACID-compliant data persistence
- **Prisma ORM**: Type-safe database queries with automated migrations
- **Inventory Tracking**: SKU-level stock management across all platforms
- **Sales Logging**: Complete audit trail of all transactions
- **Connection Management**: Store configurations and sync status

---

## 🏗️ Tech Stack

### Backend
- **Runtime**: Node.js v16+
- **Framework**: Express.js 4.18+
- **Database**: PostgreSQL 12+
- **ORM**: Prisma 5.22+
- **Authentication**: JWT (jsonwebtoken) + bcryptjs
- **Job Scheduler**: node-cron
- **HTTP Client**: Axios
- **Validation**: express-validator

### Frontend
- **UI**: HTML5, CSS3, Modern JavaScript (ES6+)
- **Design**: Responsive CSS Grid/Flexbox
- **Icons**: Font Awesome 6
- **API**: Native Fetch API
- **Storage**: LocalStorage for auth tokens

### External APIs
- **Shopify**: Admin REST API 2026-01 + OAuth 2.0
- **WooCommerce**: REST API v3
- **Prokip**: REST API at api.prokip.africa

---

## 📋 Database Schema

```prisma
model User {
  id       Int    @id @default(autoincrement())
  username String @unique
  password String // bcrypt hashed
}

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
  
  @@unique([platform, storeUrl])
}

model InventoryCache {
  id           Int        @id @default(autoincrement())
  connectionId Int
  sku          String
  quantity     Int
  connection   Connection @relation(fields: [connectionId], references: [id])
}

model SalesLog {
  id           Int        @id @default(autoincrement())
  connectionId Int
  orderId      String
  prokipSellId String?
  timestamp    DateTime   @default(now())
  connection   Connection @relation(fields: [connectionId], references: [id])
}

model ProkipConfig {
  id         Int    @id @default(1)
  token      String
  apiUrl     String
  locationId String
}
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v16 or higher
- PostgreSQL 12 or higher
- Shopify Partner account (for app credentials)
- WooCommerce store with REST API enabled (optional)

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
# Edit .env with your credentials
```

4. **Setup database**
```bash
npx prisma migrate dev
```

5. **Start the server**
```bash
npm start
```

6. **Access the dashboard**
```
https://prokip.local  (or your configured domain)
```

Default login: `admin` / `admin123`

---

## 📚 Documentation

- **[SETUP.md](SETUP.md)** - Detailed installation and configuration guide
- **[IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)** - Backend architecture and API reference
- **[FRONTEND_IMPLEMENTATION_GUIDE.md](FRONTEND_IMPLEMENTATION_GUIDE.md)** - Frontend structure and UI components
- **[MOCK_SERVER_TESTING.md](MOCK_SERVER_TESTING.md)** - Testing with mock APIs

---

## 🔧 Configuration

### Shopify Setup
1. Create app in [Shopify Partners Dashboard](https://partners.shopify.com)
2. Set **App URL**: `https://prokip.local`
3. Set **Redirect URL**: `https://prokip.local/connections/callback/shopify`
4. Configure scopes: `read_products,write_products,read_inventory,write_inventory,read_orders,write_orders,read_fulfillments,write_fulfillments`
5. Copy API credentials to `.env`

### WooCommerce Setup
1. Navigate to WordPress Admin → WooCommerce → Settings → Advanced → REST API
2. Click "Add Key"
3. Set permissions to "Read/Write"
4. Copy Consumer Key and Secret to connection form

---

## 🎯 Usage

### Connecting a Shopify Store
1. Login to dashboard
2. Click profile → "Module Settings"
3. Click "Connect Shopify"
4. Enter store URL (e.g., `mystore` or `mystore.myshopify.com`)
5. Authorize on Shopify
6. Redirected back with success notification

### Connecting a WooCommerce Store
1. Login to dashboard
2. Click profile → "Module Settings"
3. Click "Connect WooCommerce"
4. Enter store URL, Consumer Key, and Consumer Secret
5. Click "Connect Store"

### Managing Inventory
- **Auto Sync**: Runs every 5 minutes via cron job
- **Manual Sync**: Click "Sync Now" in dashboard
- **View Status**: Check connected stores and sync times
- **Disconnect**: Remove store connections as needed

---

## Project Structure

```
prokip-ecommerce-integration/
├── backend/
│   ├── src/
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic
│   │   ├── middlewares/     # Auth & validation
│   │   └── app.js          # Express app
│   ├── prisma/
│   │   ├── schema.prisma   # Database schema
│   │   └── migrations/     # DB migrations
│   ├── tests/
│   │   └── mock-servers.js # Testing infrastructure
│   └── package.json
├── frontend/
│   └── public/
│       ├── index.html      # Dashboard UI
│       ├── script.js       # Frontend logic
│       └── styles.css      # Styling
└── README.md
```

---

## Testing

### Mock Mode
Enable mock servers for local testing without real API credentials:

```bash
# In .env
MOCK_MODE=true

# Start mock servers
node backend/tests/mock-servers.js
```

See [MOCK_SERVER_TESTING.md](MOCK_SERVER_TESTING.md) for details.

---

## 🔐 Security Features

- JWT-based authentication with secure token storage
- bcrypt password hashing
- OAuth 2.0 state parameter for CSRF protection
- Environment-based credential management
- Input validation on all API endpoints
- HTTPS required for production webhooks

---

## 📦 Deployment Considerations

### Production Checklist
- [ ] Update `JWT_SECRET` to strong random value
- [ ] Configure HTTPS with valid SSL certificate
- [ ] Update redirect URIs in Shopify app settings
- [ ] Set `NODE_ENV=production`
- [ ] Configure PostgreSQL connection pooling
- [ ] Set up process manager (PM2, systemd)
- [ ] Configure reverse proxy (Nginx, Caddy)
- [ ] Enable database backups
- [ ] Set up monitoring and logging
- [ ] Review and update CORS settings

---

## 🤝 Support

For issues, questions, or contributions, please refer to the project documentation or contact the development team.

---

## 📄 License

[Your License Here]

---

**Built with for Prokip**
  connectionId Int
  sku          String
  quantity     Int
  connection   Connection @relation(fields: [connectionId], references: [id])
}

model SalesLog {
  id           Int        @id @default(autoincrement())
  connectionId Int
  orderId      String     // Store order ID
  prokipSellId String?    // Prokip transaction ID
  timestamp    DateTime   @default(now())
  connection   Connection @relation(fields: [connectionId], references: [id])
}

model ProkipConfig {
  id         Int     @id @default(1)
  token      String  // Prokip API token
  apiUrl     String  // Prokip API base URL
  locationId String  // Prokip location/branch ID
}
```

## Project Structure

```
prokip-ecommerce-integration/
│
├── backend/                        # Backend application
│   ├── src/
│   │   ├── app.js                 # Express app entry point
│   │   ├── routes/
│   │   │   ├── authRoutes.js      # User registration/login
│   │   │   ├── connectionRoutes.js # Store connection management
│   │   │   ├── setupRoutes.js     # Initial setup & config
│   │   │   └── syncRoutes.js      # Manual sync triggers
│   │   ├── services/
│   │   │   ├── syncService.js     # Background sync logic
│   │   │   ├── shopifyService.js  # Shopify API integration
│   │   │   └── woocommerceService.js # WooCommerce API
│   │   └── middlewares/
│   │       └── authMiddleware.js  # JWT verification
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema
│   │   └── migrations/            # Database migrations
│   ├── .env                       # Environment variables (gitignored)
│   ├── .env.example               # Environment template
│   └── package.json               # Backend dependencies
│
├── frontend/                      # Frontend application
│   └── public/
│       ├── index.html            # Main dashboard
│       ├── setup.html            # Setup wizard
│       ├── login.html            # Authentication page
│       └── styles.css            # Global styles
│
├── README.md                      # This file
├── SETUP.md                       # Detailed setup guide
└── .gitignore                     # Git ignore rules
```

## Installation & Setup

### Prerequisites
- **Node.js** v16 or higher ([Download](https://nodejs.org))
- **PostgreSQL** 12 or higher ([Download](https://www.postgresql.org/download/))
- **Git** (for cloning the repository)

---

### Step 1: Clone Repository
```bash
git clone https://github.com/bjeptum/prokip-ecommerce-integration.git
cd prokip-ecommerce-integration
```

---

### Step 2: Setup PostgreSQL Database

#### 2.1 Start PostgreSQL Service
```bash
# On Ubuntu/Debian
sudo systemctl start postgresql
sudo systemctl enable postgresql

# On macOS (with Homebrew)
brew services start postgresql

# On Windows
# Use Services app or pg_ctl start
```

#### 2.2 Create Database
```bash
# Connect as postgres user
sudo -u postgres psql

# Inside psql terminal, run:
CREATE DATABASE prokip_integration;

# Exit psql
\q
```

#### 2.3 Set PostgreSQL Password (if needed)
```bash
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'prokip123';"
```

---

### Step 3: Configure Backend

#### 3.1 Navigate to Backend Directory
```bash
cd backend
```

#### 3.2 Install Dependencies
```bash
npm install
```

#### 3.3 Configure Environment Variables
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your credentials
nano .env  # or use your preferred editor
```

**Important variables in `.env`:**
```dotenv
# Database connection
DATABASE_URL=postgresql://postgres:prokip123@localhost:5432/prokip_integration?schema=public

# Server configuration
PORT=3000
NODE_ENV=development

# Shopify OAuth credentials (get from Shopify Partner Dashboard)
SHOPIFY_CLIENT_ID=your_shopify_api_key
SHOPIFY_CLIENT_SECRET=your_shopify_api_secret
REDIRECT_URI=http://localhost:3000/connections/callback/shopify

# Prokip API credentials
PROKIP_API=https://api.prokip.africa

# JWT secret (change this to a random string)
JWT_SECRET=your_very_strong_jwt_secret_here_change_in_production
```

#### 3.4 Run Database Migrations
```bash
# Generate Prisma Client for your OS
npm run prisma:generate

# Push database schema to PostgreSQL
npm run prisma:migrate
```

This creates all necessary tables in your PostgreSQL database.

---

### Step 4: Start the Application

```bash
# Start the backend server
npm start
```

Expected output:
```
Backend server running on http://localhost:3000
```

---

### Step 5: Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

#### First-time Setup:
1. **Register an account** at `/login.html`
2. **Login** with your credentials
3. **Configure Prokip** credentials in the setup page
4. **Connect stores** (Shopify or WooCommerce)


## Authentication Flow

### User Registration/Login
```bash
# Register new user
POST /auth/register
{
  "username": "admin",
  "password": "securepassword123"
}

# Login
POST /auth/login
{
  "username": "admin",
  "password": "securepassword123"
}

# Returns JWT token for authenticated requests
```

### Protected Routes
All `/connections`, `/setup`, and `/sync` routes require JWT authentication.

Include token in requests:
```
Authorization: Bearer <your-jwt-token>
```

## How It Works

### 1. Connection Flow

#### Shopify OAuth Flow
```
User clicks "Connect Shopify"
  ↓
Redirects to Shopify OAuth consent page
  ↓
User approves access
  ↓
Shopify redirects back with authorization code
  ↓
Backend exchanges code for permanent access token
  ↓
Token stored in PostgreSQL (Connection table)
  ↓
Webhooks registered with Shopify
```

#### WooCommerce Connection
```
User enters store URL + Consumer Key/Secret
  ↓
Backend validates credentials via WooCommerce API
  ↓
Credentials stored in PostgreSQL (encrypted)
  ↓
Webhook endpoints configured
```

---

### 2. Synchronization Flow

#### Store → Prokip (Webhook-based)
```
Customer places order on Shopify/WooCommerce
  ↓
Store sends webhook to /connections/webhook/{platform}
  ↓
Backend parses order data
  ↓
Updates InventoryCache (decrements quantity)
  ↓
Creates SalesLog entry
  ↓
Sends order to Prokip API
  ↓
Prokip processes sale and returns sell_id
  ↓
Updates SalesLog with prokipSellId
```

#### Prokip → Stores (Scheduled Polling)
```
Cron job runs every 5 minutes
  ↓
Fetches current inventory from Prokip API
  ↓
Compares with InventoryCache
  ↓
For each changed SKU:
  - Updates InventoryCache
  - Pushes new quantity to all connected stores
  - Updates lastSync timestamp
```

---

### 3. Data Flow Diagram

```
┌─────────────────┐         ┌─────────────────┐
│  Shopify Store  │         │ WooCommerce     │
│  (Location 1)   │         │ Store (Loc 2)   │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │ Webhooks (Orders)         │ Webhooks
         │                           │
         ▼                           ▼
┌────────────────────────────────────────────────┐
│         Prokip Integration Backend             │
│         (Express + Prisma + PostgreSQL)        │
│                                                │
│  Routes:                                       │
│  • POST /auth/register - User signup           │
│  • POST /auth/login - Authentication           │
│  • POST /connections/shopify - OAuth           │
│  • POST /connections/woocommerce - Connect     │
│  • GET  /connections - List all stores         │
│  • POST /connections/webhook/:platform         │
│  • POST /sync/manual - Force sync              │
│                                                │
│  Background Jobs:                              │
│  • pollProkipToStores() - Every 5 min          │
└────────────────┬───────────────────────────────┘
                 │
                 │ Prisma ORM
                 ▼
┌────────────────────────────────────────────────┐
│          PostgreSQL Database                   │
│          (prokip_integration)                  │
│                                                │
│  Tables:                                       │
│  • User (authentication)                       │
│  • Connection (store configs)                  │
│  • InventoryCache (SKU tracking)               │
│  • SalesLog (audit trail)                      │
│  • ProkipConfig (API credentials)              │
└────────────────┬───────────────────────────────┘
                 │
                 │ API Requests
                 ▼
┌────────────────────────────────────────────────┐
│           Prokip API                           │
│           https://api.prokip.africa            │
│                                                │
│  Endpoints Used:                               │
│  • GET /inventory - Fetch current stock        │
│  • POST /sells - Record sales                  │
└────────────────────────────────────────────────┘
```

## API Endpoints Reference

### Authentication Endpoints

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "username": "admin",
  "password": "securepassword123"
}

Response: 201 Created
{
  "message": "User registered successfully"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "securepassword123"
}

Response: 200 OK
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### Connection Management (Requires JWT)

#### Connect Shopify Store
```http
GET /connections/shopify?shop=mystore.myshopify.com
Authorization: Bearer <jwt-token>

Response: Redirects to Shopify OAuth
```

#### Connect WooCommerce Store
```http
POST /connections/woocommerce
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "storeUrl": "https://mystore.com",
  "consumerKey": "ck_xxxxxxxxxxxx",
  "consumerSecret": "cs_xxxxxxxxxxxx"
}

Response: 200 OK
{
  "message": "WooCommerce store connected successfully"
}
```

#### List All Connections
```http
GET /connections
Authorization: Bearer <jwt-token>

Response: 200 OK
[
  {
    "id": 1,
    "platform": "shopify",
    "storeUrl": "mystore.myshopify.com",
    "lastSync": "2025-12-23T10:30:00Z"
  }
]
```

#### Receive Webhooks (Public endpoint)
```http
POST /connections/webhook/shopify
Content-Type: application/json

{
  "id": 123456789,
  "line_items": [
    {
      "sku": "SHIRT-001",
      "quantity": 2
    }
  ]
}

Response: 200 OK
```

---

### Sync Endpoints (Requires JWT)

#### Manual Sync
```http
POST /sync/manual
Authorization: Bearer <jwt-token>

Response: 200 OK
{
  "message": "Sync completed successfully"
}
```

---

### Setup Endpoints (Requires JWT)

#### Configure Prokip Credentials
```http
POST /setup/prokip
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "token": "prokip_api_token_here",
  "apiUrl": "https://api.prokip.africa",
  "locationId": "LOCATION_001"
}

Response: 200 OK
{
  "message": "Prokip configured successfully"
}
```

## Real-World Usage Scenarios

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CUSTOMER'S BUSINESS                          │
│                                                                 │
│  ┌──────────────┐              ┌──────────────┐               │
│  │Shopify Store │              │WooCommerce   │               │
│  │(Location 1)  │              │Store (Loc 2) │               │
│  │ Online     │                │ Online     │               │
│  └──────┬───────┘              └──────┬───────┘               │
│         │                              │                       │
└─────────┼──────────────────────────────┼───────────────────────┘
          │                              │
          │ Webhooks (Real-time)         │ Webhooks
          │ POST /webhook/shopify        │ POST /webhook/woocommerce
          │                              │
          ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              PROKIP INTEGRATION SERVER                          │
│              Node.js + PostgreSQL                               │
│              http://localhost:3000                              │
│                                                                 │
│  API Endpoints:                                                 │
│  • GET  /api/connections   - List connected stores              │
│  • GET  /connect/{platform}- Connect new store                  │
│  • POST /api/setup        - Configure pull/push                 │
│  • POST /api/pull         - Pull products from store            │
│  • POST /api/push         - Push products to store              │
│  • POST /webhook/{platform}- Receive webhooks                   │
│  • POST /api/toggle       - Enable/disable sync                 │
│  • POST /api/sync-now     - Force manual sync                   │
│  • POST /api/disconnect   - Remove connection                   │
│                                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ SQL Queries (pg module)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                            │
│                  (prokip_integration)                           │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────┐  │
│  │connections       │  │inventory         │  │sales_logs   │  │
│  │─────────────────│  │─────────────────│  │─────────────│  │
│  │id (PK)          │  │sku (PK)         │  │id (PK)      │  │
│  │platform         │  │name             │  │order_id     │  │
│  │store_name       │  │quantity         │  │sku          │  │
│  │token            │  │price            │  │quantity     │  │
│  │status           │  │image_url        │  │platform     │  │
│  │last_sync        │  └─────────────────┘  │status       │  │
│  │sync_enabled     │                       │created_at   │  │
│  │location_id      │                       └─────────────┘  │
│  │choice (pull/push)│                                        │
│  └──────────────────┘                                        │
└─────────────────────────────────────────────────────────────────┘
                         ▲
                         │ Fetch data
                         │
┌────────────────────────┴─────────────────────────────────────────┐
│                    WEB DASHBOARD                                 │
│                    (Browser Interface)                           │
│                                                                  │
│  index.html - Main page                                          │
│  • Location selector dropdown                                    │
│  • [Connect Shopify] [Connect WooCommerce] buttons               │
│  • Connected stores list (auto-refresh every 10s)                │
│  • Per-store controls: Toggle | Sync Now | Disconnect            │
│                                                                  │
│  setup.html - Configuration wizard                               │
│  • Radio buttons: Pull vs Push strategy                          │
│  • Product matching interface                                    │
│  • Price/image configuration forms                               │
└──────────────────────────────────────────────────────────────────┘
```

## Real-World Usage Scenarios

### Scenario 1: First-Time Setup & Shopify Connection

```
Step 1: User Registration
  ↓
POST /auth/register
{username: "admin", password: "secure123"}
  ↓
User account created in PostgreSQL
  ↓
POST /auth/login
  ↓
Receives JWT token
  ↓
Stores token in browser (sessionStorage)

Step 2: Configure Prokip API
  ↓
POST /setup/prokip (with JWT)
{
  token: "prokip_api_xxx",
  apiUrl: "https://api.prokip.africa",
  locationId: "LOC001"
}
  ↓
ProkipConfig table updated

Step 3: Connect Shopify Store
  ↓
GET /connections/shopify?shop=mystore.myshopify.com (with JWT)
  ↓
Redirects to Shopify OAuth consent page
  ↓
User approves access
  ↓
Shopify calls back: GET /connections/callback/shopify?code=xxx
  ↓
Backend exchanges code for permanent access_token
  ↓
Prisma creates Connection record:
  - platform: "shopify"
  - storeUrl: "mystore.myshopify.com"
  - accessToken: "shpat_xxxxx"
  ↓
Backend registers webhooks with Shopify:
  - POST https://mystore.myshopify.com/admin/api/webhooks.json
  - Topic: "orders/create"
  - Address: "http://yourdomain.com/connections/webhook/shopify"
  ↓
Connection complete!
```

---

### Scenario 2: Customer Places Order on Shopify

```
1. Customer buys 3 T-Shirts (SKU: SHIRT-001) on Shopify
  ↓
2. Shopify processes payment
  ↓
3. Shopify sends webhook
  ↓
POST /connections/webhook/shopify
{
  "id": 789456123,
  "line_items": [
    {
      "sku": "SHIRT-001",
      "quantity": 3
    }
  ]
}
  ↓
4. Backend receives webhook
  ↓
5. Finds Connection by storeUrl
  ↓
6. Updates InventoryCache:
   - Find or create SHIRT-001
   - Decrease quantity by 3
  ↓
7. Creates SalesLog entry:
   - orderId: "789456123"
   - sku: "SHIRT-001"
   - quantity: 3
   - timestamp: NOW()
  ↓
8. Sends sale to Prokip API:
   POST https://api.prokip.africa/sells
   {
     "locationId": "LOC001",
     "items": [{
       "sku": "SHIRT-001",
       "quantity": 3
     }]
   }
  ↓
9. Prokip processes sale and returns sell_id
  ↓
10. Updates SalesLog with prokipSellId
  ↓
11. All stores now see updated inventory (3 less)
```

---

### Scenario 3: Background Sync (Prokip → Stores)

```
Every 5 minutes, cron job runs:
  ↓
pollProkipToStores() executes
  ↓
1. Fetches ProkipConfig from database
  ↓
2. Calls Prokip API:
   GET https://api.prokip.africa/inventory?locationId=LOC001
   Returns: [
     {sku: "SHIRT-001", quantity: 50},
     {sku: "PANTS-002", quantity: 30}
   ]
  ↓
3. Fetches all connections from database
  ↓
4. For each SKU:
   - Compare Prokip quantity with InventoryCache
   - If different:
     a) Update InventoryCache
     b) Push to Shopify:
        PUT /admin/api/products/{id}/variants/{variant_id}.json
        {inventory_quantity: 50}
     c) Push to WooCommerce:
        PUT /wp-json/wc/v3/products/{id}
        {stock_quantity: 50}
  ↓
5. Update Connection.lastSync for each store
  ↓
6. All stores now have synchronized inventory!
```
   Merchant selects: "PULL" (use Shopify products)
   Click: [Continue Setup]

5. Save strategy (server.js lines 89-96)
   Browser: POST /api/setup
   Body: platform=shopify&choice=pull
   Database: UPDATE connections 
               SET choice='pull' 
               WHERE platform='shopify'

6. Pull products (server.js lines 98-107)
   Browser: POST /api/pull
   Server returns: [{sku:'shirt1', name:'T-Shirt', 
                        price:20, quantity:100, status:'matched'}]
   UI shows: Product list with status badges

RESULT: Shopify store connected with PULL strategy
```

### Scenario 2: Real-time Sale on Shopify

```
1. Customer buys 2 T-Shirts on Shopify
   Shopify processes payment
   Shopify creates order #12345
   Shopify triggers webhook

2. Webhook received (server.js lines 135-173)
   POST /webhook/shopify
   Body: {"orderId":"12345", "sku":"shirt1", 
            "quantity":2, "status":"completed"}

3. Server processes webhook
   Parse platform from URL: 'shopify'
   Validate: sku and quantity present ✓
   Database: BEGIN transaction

4. Update inventory
   Database: UPDATE inventory 
               SET quantity = quantity - 2 
               WHERE sku = 'shirt1'
   BEFORE: 100 shirts
   AFTER: 98 shirts

5. Log the sale
   Database: INSERT INTO sales_logs 
               (order_id, sku, quantity, platform, status)
               VALUES ('12345', 'shirt1', 2, 'shopify', 'completed')

6. Update sync timestamp
   Database: UPDATE connections 
               SET last_sync = NOW() 
               WHERE platform = 'shopify'

7. Commit transaction
   Database: COMMIT
   Response: 200 OK "Sync processed"

8. Dashboard auto-refresh (every 10 seconds)
   Browser: GET /api/connections
   UI updates: "Last Sync: Just now"

RESULT: Inventory reduced from 100 → 98 shirts in real-time
```

### Scenario 3: Multi-Store Unified Inventory

```
SETUP:
- Shopify connected to Location 1 (PULL strategy)
- WooCommerce connected to Location 2 (PUSH strategy)
- Both share same inventory table

EVENT SEQUENCE:
┌─────────────────────────────────────────────────────┐
│ Initial inventory: shirt1 quantity = 100           │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ Customer A buys 2 shirts on Shopify                 │
│ Webhook → UPDATE inventory SET quantity = 100 - 2   │
│ New quantity: 98                                    │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ Customer B buys 3 shirts on WooCommerce             │
│ Webhook → UPDATE inventory SET quantity = 98 - 3    │
│ New quantity: 95                                    │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ Customer A returns 1 shirt (refund)                 │
│ Webhook → UPDATE inventory SET quantity = 95 + 1    │
│ New quantity: 96                                    │
└─────────────────────────────────────────────────────┘

RESULT: Unified inventory across both platforms
- Shopify sees: 96 shirts available
- WooCommerce sees: 96 shirts available
- Prokip dashboard shows: 96 shirts
- All platforms always in sync ✓
```

##  API Endpoints Reference

### 1. GET `/api/connections`
**Purpose**: Retrieve all connected stores  
**Response**:
```json
[
  {
    "id": 1,
    "platform": "shopify",
    "store_name": "Shopify Store",
    "status": "connected",
    "last_sync": "2025-12-17T10:30:00Z",
    "sync_enabled": true,
    "location_id": "location1",
    "choice": "pull"
  }
]
```

### 2. GET `/connect/{platform}?location={locationId}`
**Purpose**: Connect a new store  
**Parameters**: 
- `platform`: 'shopify' or 'woocommerce'
- `location`: Business location ID
**Action**: 
- Creates connection record in database
- Redirects to setup wizard

### 3. POST `/api/setup`
**Purpose**: Save pull/push strategy  
**Body**: `platform=shopify&choice=pull`  
**Database**: `UPDATE connections SET choice='pull' WHERE platform='shopify'`

### 4. POST `/api/pull`
**Purpose**: Pull products from online store  
**Response**: Array of products with match status
```json
[
  {"sku":"shirt1", "name":"T-Shirt", "price":20, "quantity":100, "status":"matched"}
]
```

### 5. POST `/api/push`
**Purpose**: Push products to online store  
**Body**: Form data with prices and images  
**Database**: `INSERT INTO inventory ... ON CONFLICT UPDATE`

### 6. POST `/webhook/{platform}`
**Purpose**: Receive real-time events from stores  
**Body**:
```json
{
  "orderId": "12345",
  "sku": "shirt1",
  "quantity": 2,
  "status": "completed"
}
```
**Actions**:
- `status='completed'`: Reduces inventory
- `status='refunded'`: Restores inventory
- Updates `last_sync` timestamp
- Logs sale in `sales_logs` table

### 7. POST `/api/toggle`
**Purpose**: Enable/disable auto-sync  
**Body**: `platform=shopify`  
**Database**: `UPDATE connections SET sync_enabled = NOT sync_enabled`

### 8. POST `/api/sync-now`
**Purpose**: Force manual synchronization  
**Database**: `UPDATE connections SET last_sync = NOW()`

### 9. POST `/api/disconnect`
**Purpose**: Remove store connection  
**Database**: `DELETE FROM connections WHERE platform='shopify'`  
**Note**: Inventory data is preserved

---##  Security Considerations

### Current Implementation (Demo/Development)
- **Token Storage**: Fake tokens stored in plain text
- **Authentication**: Simulated OAuth flow
- **Password**: Hardcoded in `server.js`

### Production Recommendations
1. **Environment Variables**: Store credentials in `.env` file
   ```bash
   DB_USER=postgres
   DB_PASSWORD=secure_password_here
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=prokip_integration
   ```

2. **Real OAuth**: Implement proper OAuth 2.0 flows
   - Shopify: Use Shopify App OAuth
   - WooCommerce: Use WooCommerce REST API authentication

3. **Token Encryption**: Encrypt store tokens before database storage

4. **HTTPS**: Deploy with SSL/TLS certificates

5. **API Rate Limiting**: Prevent abuse of webhook endpoints

6. **Input Validation**: Sanitize all user inputs

7. **SQL Injection Prevention**: Already using parameterized queries


---

## 🧪 Testing the System

### Prerequisites for Testing
```bash
# Ensure PostgreSQL is running
sudo systemctl status postgresql

# Ensure backend server is running
cd backend
npm start
```

---

### Test 1: User Registration & Authentication
```bash
# Register new user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123"}'

# Expected: {"message":"User registered successfully"}

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123"}'

# Expected: {"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
# Save this token for subsequent requests
```

---

### Test 2: Configure Prokip
```bash
# Set TOKEN variable from login response
TOKEN="your_jwt_token_here"

# Configure Prokip credentials
curl -X POST http://localhost:3000/setup/prokip \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token":"prokip_api_token",
    "apiUrl":"https://api.prokip.africa",
    "locationId":"LOC001"
  }'

# Expected: {"message":"Prokip configured successfully"}
```

---

### Test 3: Connect WooCommerce Store
```bash
curl -X POST http://localhost:3000/connections/woocommerce \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "storeUrl":"https://mystore.com",
    "consumerKey":"ck_test_key",
    "consumerSecret":"cs_test_secret"
  }'

# Expected: {"message":"WooCommerce store connected successfully"}
```

---

### Test 4: List Connections
```bash
curl -X GET http://localhost:3000/connections \
  -H "Authorization: Bearer $TOKEN"

# Expected: Array of connections
[
  {
    "id": 1,
    "platform": "woocommerce",
    "storeUrl": "https://mystore.com",
    "lastSync": "2025-12-23T10:30:00Z"
  }
]
```

---

### Test 5: Simulate Webhook (Order Placed)
```bash
# Simulate Shopify order webhook
curl -X POST http://localhost:3000/connections/webhook/shopify \
  -H "Content-Type: application/json" \
  -d '{
    "id": 123456789,
    "line_items": [
      {
        "sku": "SHIRT-001",
        "quantity": 5
      }
    ]
  }'

# Expected: 200 OK
```

---

### Test 6: Verify Database Changes
```bash
# Connect to PostgreSQL
psql -h localhost -U postgres -d prokip_integration

# Check connections
SELECT * FROM "Connection";

# Check inventory cache
SELECT * FROM "InventoryCache";

# Check sales log
SELECT * FROM "SalesLog";

# Exit
\q
```

---

### Test 7: Manual Sync
```bash
curl -X POST http://localhost:3000/sync/manual \
  -H "Authorization: Bearer $TOKEN"

# Expected: {"message":"Sync completed successfully"}
```

---

### Test 8: View Database with Prisma Studio
```bash
cd backend
npx prisma studio

# Opens GUI at http://localhost:5555
# Explore all tables visually
```


## Security Best Practices

### Current Implementation
- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt with salt rounds
- **Environment Variables**: Credentials in .env (gitignored)
- **Prisma ORM**: SQL injection prevention
- **HTTPS-ready**: Can deploy with SSL/TLS

### Production Recommendations

1. **Stronger JWT Secrets**
   ```bash
   # Generate strong secret
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. **Rate Limiting**
   ```javascript
   npm install express-rate-limit
   // Add to app.js
   const rateLimit = require('express-rate-limit');
   app.use('/auth', rateLimit({windowMs: 15*60*1000, max: 5}));
   ```

3. **CORS Configuration**
   ```javascript
   npm install cors
   const cors = require('cors');
   app.use(cors({origin: 'https://yourdomain.com'}));
   ```

4. **Helmet Security Headers**
   ```javascript
   npm install helmet
   const helmet = require('helmet');
   app.use(helmet());
   ```

5. **SSL/TLS Certificates**
   - Use Let's Encrypt for free SSL
   - Configure HTTPS in production

6. **Database Security**
   - Use strong PostgreSQL passwords
   - Enable SSL for database connections
   - Regular backups

## Troubleshooting

### Issue: "Prisma Client not generated"
```bash
cd backend
npm run prisma:generate
```

### Issue: "Database connection failed"
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Verify DATABASE_URL in .env
cat backend/.env | grep DATABASE_URL

# Test connection
psql -h localhost -U postgres -d prokip_integration
```

### Issue: "Port 3000 already in use"
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9

# Or change PORT in .env
PORT=3001
```

### Issue: "JWT token invalid"
```bash
# Ensure JWT_SECRET matches in .env
# Re-login to get new token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"youruser","password":"yourpass"}'
```

## Database Management Commands

```bash
# View all tables
psql -h localhost -U postgres -d prokip_integration -c "\dt"

# Backup database
pg_dump -h localhost -U postgres prokip_integration > backup.sql

# Restore database
psql -h localhost -U postgres prokip_integration < backup.sql

# Reset database (deletes all data)
cd backend
npx prisma migrate reset

# Create new migration
npx prisma migrate dev --name add_new_feature

# View migration history
psql -h localhost -U postgres -d prokip_integration \
  -c "SELECT * FROM _prisma_migrations;"
```

## Deployment Guide

### Environment Setup
1. **Production Database**: Use managed PostgreSQL (AWS RDS, DigitalOcean, etc.)
2. **Environment Variables**: Set in production server
3. **SSL Certificates**: Install Let's Encrypt
4. **Process Manager**: Use PM2 for Node.js

### PM2 Deployment
```bash
# Install PM2
npm install -g pm2

# Start application
cd backend
pm2 start src/app.js --name prokip-integration

# Enable auto-restart on reboot
pm2 startup
pm2 save

# Monitor
pm2 monit
```


### Test 2: Simulate Webhook (Sale)
```bash
curl -X POST http://localhost:3000/webhook/shopify \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "TEST-001",
    "sku": "shirt1",
    "quantity": 5,
    "status": "completed"
  }'

# Check inventory
psql -h localhost -U postgres -d prokip_integration
SELECT * FROM inventory WHERE sku='shirt1';
```

### Test 3: Simulate Refund
```bash
curl -X POST http://localhost:3000/webhook/shopify \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "TEST-001",
    "sku": "shirt1",
    "quantity": 2,
    "status": "refunded"
  }'

# Verify quantity increased
psql -h localhost -U postgres -d prokip_integration
SELECT * FROM inventory WHERE sku='shirt1';
```


## Future Enhancements

### Phase 2 (Production)
- [ ] Real Shopify OAuth integration
- [ ] Real WooCommerce REST API integration
- [ ] Actual product fetching from store APIs
- [ ] Webhook signature verification
- [ ] User authentication system
- [ ] Multi-tenant support (multiple businesses)

### Phase 3 (Advanced)
- [ ] Product image uploads
- [ ] Bulk product operations
- [ ] Advanced inventory rules (low stock alerts)
- [ ] Analytics dashboard (sales trends, top products)
- [ ] Export/import functionality
- [ ] Email notifications
- [ ] Mobile responsive improvements
- [ ] Dark mode theme


## Troubleshooting

### Issue: "password authentication failed for user postgres"
**Solution**: Reset PostgreSQL password
```bash
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'prokip123';"
echo "localhost:5432:*:postgres:prokip123" > ~/.pgpass
chmod 600 ~/.pgpass
```

### Issue: "database prokip_integration does not exist"
**Solution**: Create the database
```bash
sudo -u postgres psql -c "CREATE DATABASE prokip_integration;"
```

### Issue: "relation 'connections' does not exist"
**Solution**: Run table creation SQL (see Step 3.2)

### Issue: "Port 3000 already in use"
**Solution**: Kill existing process
```bash
lsof -ti:3000 | xargs kill -9
```

### Issue: PostgreSQL not running
**Solution**: Start PostgreSQL service
```bash
sudo systemctl start postgresql
```

## Database Management

### View all connections
```sql
SELECT * FROM connections;
```

### View inventory
```sql
SELECT * FROM inventory;
```

### Check sales logs
```sql
SELECT * FROM sales_logs ORDER BY created_at DESC;
```

### Reset inventory quantity
```sql
UPDATE inventory SET quantity = 100 WHERE sku = 'shirt1';
```

### Delete all connections
```sql
TRUNCATE TABLE connections RESTART IDENTITY CASCADE;
```