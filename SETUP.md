# Prokip E-commerce Integration - Setup Guide

## Overview

Complete setup instructions for the Prokip E-commerce Integration platform - a production-ready system connecting Shopify and WooCommerce stores with the Prokip inventory management system.

### System Requirements
- **Node.js** v16+ ([Download](https://nodejs.org))
- **PostgreSQL** 12+ ([Download](https://www.postgresql.org/download/))
- **HTTPS domain** (required for Shopify OAuth - use Caddy, Nginx, or ngrok)
- **Shopify Partner Account** (free at [partners.shopify.com](https://partners.shopify.com))
- **WooCommerce store** with REST API enabled (optional)

---

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd prokip-ecommerce-integration/backend
npm install
```

### 2. Setup PostgreSQL

**Start PostgreSQL:**
```bash
# Ubuntu/Debian
sudo systemctl start postgresql
sudo systemctl enable postgresql

# macOS (Homebrew)
brew services start postgresql

# Windows - use Services app or:
pg_ctl start -D "C:\Program Files\PostgreSQL\14\data"
```

**Create Database:**
```bash
# Connect as postgres user
sudo -u postgres psql

# Create database
CREATE DATABASE prokip_integration;

# Set password (if needed)
ALTER USER postgres PASSWORD 'prokip123';

# Exit
\q
```

### 3. Configure Environment

```bash
# Copy example file
cp .env.example .env

# Edit with your settings
nano .env
```

**Required `.env` Configuration:**

```dotenv
# Database
DATABASE_URL=postgresql://postgres:prokip123@localhost:5432/prokip_integration?schema=public

# Server
PORT=3000
NODE_ENV=development

# Mock Mode (false for production, true for testing)
MOCK_MODE=false

# Shopify Credentials (from Partners Dashboard)
SHOPIFY_CLIENT_ID=your_api_key_here
SHOPIFY_CLIENT_SECRET=your_api_secret_here
SHOPIFY_SCOPES=read_products,write_products,read_inventory,write_inventory,read_orders,write_orders,read_fulfillments,write_fulfillments

# URLs (update with your domain)
REDIRECT_URI=https://prokip.local/connections/callback/shopify
WEBHOOK_URL=https://prokip.local/connections/webhook/shopify

# Prokip API
PROKIP_API=https://api.prokip.africa

# JWT Secret (generate random string)
JWT_SECRET=change_this_to_a_very_long_random_string_in_production

# Default Admin
DEFAULT_ADMIN_USER=admin
DEFAULT_ADMIN_PASS=admin123
```

### 4. Database Migration

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev
```

This creates the database schema with tables:
- `User` - Authentication
- `Connection` - Store connections
- `InventoryCache` - SKU inventory
- `SalesLog` - Transaction history
- `ProkipConfig` - Prokip credentials

### 5. Start Application

```bash
npm start
```

Expected output:
```
Server running on http://localhost:3000
Cron job scheduled: Prokip → Stores inventory sync every 5 minutes
```

### 6. Access Dashboard

Navigate to: `https://prokip.local` (or your configured domain)

Default login:
- Username: `admin`
- Password: `admin123`

---

## Shopify App Setup

### Create Shopify App

1. Go to [Shopify Partners](https://partners.shopify.com)
2. Click **Apps** → **Create App**
3. Choose **Create app manually**
4. Fill in details:
   - **App name**: Prokip Integration
   - **App URL**: `https://prokip.local`
   - **Allowed redirection URL(s)**: `https://prokip.local/connections/callback/shopify`

### Configure Permissions

Under **Configuration** → **App setup**:

**Scopes:**
```
read_products
write_products
read_inventory
write_inventory
read_orders
write_orders
read_fulfillments
write_fulfillments
```

### Get Credentials

Under **Overview**:
- Copy **API key** → Set as `SHOPIFY_CLIENT_ID` in `.env`
- Copy **API secret key** → Set as `SHOPIFY_CLIENT_SECRET` in `.env`

### Install App (Testing)

1. Under **Test your app**, select a development store
2. Click **Install app**
3. Or use the install URL: `https://{store}.myshopify.com/admin/oauth/authorize?client_id={CLIENT_ID}`

---

## HTTPS Configuration

### Option 1: Caddy (Recommended)

**Install Caddy:**
```bash
# Ubuntu/Debian
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

**Caddyfile:**
```
prokip.local {
    reverse_proxy localhost:3000
}
```

**Start Caddy:**
```bash
sudo caddy start
```

### Option 2: ngrok (Development)

```bash
# Install ngrok
npm install -g ngrok

# Start tunnel
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`) and update:
- `.env` → `REDIRECT_URI` and `WEBHOOK_URL`
- Shopify app settings → Redirect URLs

---

## WooCommerce Setup

### Enable REST API

1. Go to WordPress Admin → **WooCommerce** → **Settings**
2. Navigate to **Advanced** → **REST API**
3. Click **Add Key**
4. Set:
   - **Description**: Prokip Integration
   - **User**: Your admin user
   - **Permissions**: Read/Write
5. Click **Generate API Key**
6. Copy **Consumer key** and **Consumer secret**

### Connect in Dashboard

1. Login to Prokip dashboard
2. Click profile → **Module Settings**
3. Click **Connect WooCommerce**
4. Enter:
   - **Store URL**: `https://yourstore.com`
   - **Consumer Key**: (from above)
   - **Consumer Secret**: (from above)
5. Click **Connect Store**

---

## Troubleshooting

### Database Connection Issues

**Error:** `Can't reach database server`

**Solution:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection
psql -U postgres -d prokip_integration

# Verify DATABASE_URL in .env
```

### Prisma Client Errors

**Error:** `Cannot find module '@prisma/client'`

**Solution:**
```bash
npx prisma generate
npm install
```

### Shopify OAuth Errors

**Error:** `Redirect URI mismatch`

**Solution:**
- Ensure `.env` `REDIRECT_URI` matches Shopify app settings exactly
- Must use HTTPS (except localhost)
- Check for trailing slashes

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3000`

**Solution:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change PORT in .env
```

---

## Testing Setup

### Mock Mode

For testing without real API credentials:

```bash
# In .env
MOCK_MODE=true

# Start mock servers
node tests/mock-servers.js

# In another terminal
npm start
```

See [MOCK_SERVER_TESTING.md](MOCK_SERVER_TESTING.md) for details.

### Verify Installation

```bash
# Check database
npx prisma studio

# Test API
curl http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

---

## Production Deployment

### Pre-deployment Checklist

- [ ] Update `JWT_SECRET` to strong random value
- [ ] Change default admin password
- [ ] Set `NODE_ENV=production`
- [ ] Configure production database with SSL
- [ ] Update all URLs to production domain
- [ ] Enable database backups
- [ ] Set up process manager (PM2)
- [ ] Configure reverse proxy (Nginx/Caddy)
- [ ] Set up monitoring and logging
- [ ] Review Shopify app settings
- [ ] Test webhook delivery

### PM2 Setup

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start src/app.js --name prokip-integration

# Enable startup script
pm2 startup
pm2 save
```

---

## Next Steps

1. Complete setup
2. Read [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) for architecture details
3. Review [FRONTEND_IMPLEMENTATION_GUIDE.md](FRONTEND_IMPLEMENTATION_GUIDE.md) for UI customization
4. Test with [MOCK_SERVER_TESTING.md](MOCK_SERVER_TESTING.md)
5. Connect your first store!




