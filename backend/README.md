# Backend - Prokip E-commerce Integration

## Overview

Express.js backend server for the Prokip E-commerce Integration platform. Provides REST API endpoints for connecting Shopify and WooCommerce stores with the Prokip inventory management system.

---

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Setup database
npx prisma generate
npx prisma migrate dev

# Start server
npm start
```

Server runs at: `http://localhost:3000`

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start the server |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Push schema to database |

---

## Project Structure

```
backend/
├── src/
│   ├── app.js                      # Express app entry point
│   ├── routes/                     # API route handlers
│   │   ├── authRoutes.js           # Prokip authentication
│   │   ├── connectionRoutes.js     # Store connections
│   │   ├── prokipRoutes.js         # Prokip operations
│   │   ├── storeRoutes.js          # Store data
│   │   ├── syncRoutes.js           # Sync operations
│   │   ├── setupRoutes.js          # Product setup
│   │   └── webhookRoutes.js        # Webhook handlers
│   ├── services/                   # Business logic
│   │   ├── prokipService.js        # Prokip API
│   │   ├── shopifyService.js       # Shopify API
│   │   ├── wooService.js           # WooCommerce API
│   │   ├── storeService.js         # Store operations
│   │   └── syncService.js          # Sync logic
│   └── middlewares/
│       └── authMiddleware.js       # JWT auth
├── prisma/
│   ├── schema.prisma               # Database schema
│   └── migrations/                 # Migration files
├── lib/
│   ├── prisma.js                   # Prisma client
│   └── validation.js               # Validators
├── tests/
│   ├── mock-prokip-api.js          # Mock server
│   └── Postman-Collection.json     # API tests
└── .env                            # Configuration
```

---

## Environment Variables

```dotenv
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/prokip_integration

# Server
PORT=3000

# Prokip
PROKIP_API=https://api.prokip.africa

# Shopify
SHOPIFY_CLIENT_ID=your_client_id
SHOPIFY_CLIENT_SECRET=your_client_secret
SHOPIFY_SCOPES=read_products,write_products,read_inventory,write_inventory,read_locations,read_orders
REDIRECT_URI=https://your-domain.com/connections/callback/shopify

# Mock Mode (for testing)
MOCK_PROKIP=false
MOCK_SHOPIFY=false
MOCK_WOO=false
```

---

## API Endpoints

### Authentication
- `POST /auth/prokip-login` - Login with Prokip credentials
- `POST /auth/prokip-location` - Set business location
- `GET /auth/prokip-locations` - Get available locations
- `POST /auth/prokip-logout` - Logout

### Connections
- `GET /connections` - List connections
- `DELETE /connections/:id` - Remove connection
- `POST /connections/shopify/initiate` - Start Shopify OAuth
- `GET /connections/callback/shopify` - Shopify callback
- `POST /connections/woocommerce/connect` - Connect WooCommerce

### Prokip
- `GET /prokip/products` - Get products
- `GET /prokip/inventory` - Get inventory
- `GET /prokip/sales` - Get sales
- `GET /prokip/purchases` - Get purchases

### Stores
- `GET /stores/:id/products` - Store products
- `GET /stores/:id/orders` - Store orders
- `GET /stores/:id/sales` - Store sales

### Sync
- `GET /sync/status` - Sync status
- `POST /sync/inventory` - Sync inventory

---

## Database

Using PostgreSQL with Prisma ORM.

**Tables:**
- `users` - User accounts
- `connections` - Store connections
- `inventory_logs` - Inventory sync logs
- `sales_logs` - Sales records
- `webhook_events` - Webhook payloads
- `prokip_config` - Prokip settings

**Commands:**
```bash
# Generate client
npx prisma generate

# Create migration
npx prisma migrate dev --name your_migration_name

# Push schema (no migration)
npx prisma db push

# Open Prisma Studio
npx prisma studio
```

---

## Dependencies

- **express** - Web framework
- **@prisma/client** - Database ORM
- **axios** - HTTP client
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT auth
- **express-validator** - Input validation
- **cors** - CORS middleware
- **dotenv** - Environment config

---

## Testing

### Mock Server

```bash
cd tests
node mock-prokip-api.js
```

### Postman

Import `tests/Postman-Collection.json` for API testing.

---

## Deployment

1. Set `NODE_ENV=production`
2. Configure production database URL
3. Set up HTTPS (required for Shopify OAuth)
4. Configure production webhook URLs
