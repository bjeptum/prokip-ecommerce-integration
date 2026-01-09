# Prokip E-commerce Integration - Setup Guide

## Overview

Complete setup instructions for the Prokip E-commerce Integration platform - a production-ready system connecting Shopify and WooCommerce stores with the Prokip inventory management system.

---

## System Requirements

- **Node.js** v16+ ([Download](https://nodejs.org))
- **PostgreSQL** 12+ ([Download](https://www.postgresql.org/download/))
- **Prokip Account** with API access
- **Shopify Partner Account** (for Shopify integration)
- **WooCommerce Store** with REST API enabled (for WooCommerce integration)

---

## Installation

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
ALTER USER postgres PASSWORD 'your_password';

# Exit
\q
```

### 3. Configure Environment

```bash
# Copy example file (or create new)
cp .env.example .env

# Edit with your settings
nano .env
```

**Required `.env` Configuration:**

```dotenv
# Database
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/prokip_integration?schema=public

# Server
PORT=3000
NODE_ENV=development

# Prokip API
PROKIP_API=https://api.prokip.africa

# Shopify OAuth Credentials (from Partners Dashboard)
SHOPIFY_CLIENT_ID=your_shopify_client_id
SHOPIFY_CLIENT_SECRET=your_shopify_client_secret
SHOPIFY_SCOPES=read_products,write_products,read_inventory,write_inventory,read_locations,read_orders
REDIRECT_URI=https://your-domain.com/connections/callback/shopify

# WooCommerce OAuth (optional)
WOOCOMMERCE_CLIENT_ID=your_woo_client_id
WOOCOMMERCE_CLIENT_SECRET=your_woo_client_secret

# Mock Mode (for development/testing)
MOCK_PROKIP=false
MOCK_SHOPIFY=false
MOCK_WOO=false
```

### 4. Database Migration

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev
```

This creates the database schema with tables:
- `users` - User authentication
- `connections` - Store connections
- `inventory_logs` - Inventory sync history
- `sales_logs` - Transaction history
- `webhook_events` - Webhook payloads
- `prokip_config` - Prokip credentials and settings

### 5. Start Application

```bash
npm start
```

Expected output:
```
✅ Database connected
🚀 Server running on http://localhost:3000
```

### 6. Access Dashboard

Navigate to: `http://localhost:3000`

Login with your **Prokip credentials** (username and password).

---

## Shopify App Setup

### Create Shopify App

1. Go to [Shopify Partners](https://partners.shopify.com)
2. Click **Apps** → **Create App**
3. Choose **Create app manually**
4. Fill in details:
   - **App name**: Prokip Integration
   - **App URL**: `https://your-domain.com`
   - **Allowed redirection URL(s)**: `https://your-domain.com/connections/callback/shopify`

### Configure API Scopes

In your Shopify app settings, add these **Admin API access scopes**:

```
read_products
write_products
read_inventory
write_inventory
read_locations
read_orders
```

**Important Notes:**
- Order webhooks (`orders/create`, `orders/paid`, etc.) require **Protected Customer Data** access
- To request protected data access, go to your app's **API access** → **Protected customer data access**
- Complete the data protection questionnaire and wait for Shopify approval

### Get API Credentials

1. In your Shopify app, go to **API credentials**
2. Copy the **API key** → `SHOPIFY_CLIENT_ID`
3. Copy the **API secret key** → `SHOPIFY_CLIENT_SECRET`
4. Add these to your `.env` file

---

## WooCommerce Setup

### Option 1: Application Password (Recommended)

1. In WordPress admin, go to **Users** → **Your Profile**
2. Scroll to **Application Passwords**
3. Enter a name (e.g., "Prokip Integration")
4. Click **Add New Application Password**
5. Copy the generated password (shown only once)

**In the dashboard:**
- Enter your store URL (e.g., `https://your-store.com`)
- Enter your WordPress username
- Enter the Application Password

### Option 2: REST API Keys

1. In WordPress admin, go to **WooCommerce** → **Settings** → **Advanced** → **REST API**
2. Click **Add Key**
3. Set:
   - **Description**: Prokip Integration
   - **User**: Select an admin user
   - **Permissions**: Read/Write
4. Click **Generate API Key**
5. Copy the **Consumer Key** and **Consumer Secret**

---

## Connecting Stores

### Connect Shopify Store

1. Login to the dashboard with your Prokip credentials
2. Select your business location
3. Click **Connect Shopify**
4. Enter your store URL (e.g., `your-store.myshopify.com`)
5. Click **Connect**
6. Authorize the app in the Shopify popup

### Connect WooCommerce Store

1. Login to the dashboard with your Prokip credentials
2. Select your business location
3. Click **Connect WooCommerce**
4. Enter your store URL
5. Enter your WordPress username
6. Enter your Application Password
7. Click **Connect**

---

## Syncing Inventory

### Manual Sync

1. Go to a connected store in the sidebar
2. Click **Sync Products**
3. Choose **Sync Inventory** to push Prokip inventory to the store

### What Gets Synced

- Product inventory quantities from Prokip → Connected stores
- Products are matched by **SKU**
- Inventory tracking is automatically enabled in Shopify if not already

### Sync Requirements

- Products must exist in both Prokip and the connected store
- Products must have matching SKUs
- For Shopify: `read_inventory`, `write_inventory`, `read_locations` scopes required

---

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -h localhost -U postgres -d prokip_integration
```

### Shopify OAuth Errors

- Verify `REDIRECT_URI` matches exactly in Shopify app settings
- Ensure HTTPS is used for production
- Check `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` are correct

### Shopify "read_locations scope not approved"

This means you need to:
1. Go to Shopify Partners → Your App → API access
2. Add `read_locations` to your scopes
3. Re-authorize the app on your store

### Shopify "Inventory item does not have inventory tracking enabled"

The system automatically enables inventory tracking, but if it fails:
1. Go to your Shopify product
2. Check "Track quantity"
3. Try syncing again

### WooCommerce Connection Fails

- Verify the store URL is correct (include `https://`)
- Check REST API is enabled in WooCommerce settings
- Ensure your user has admin permissions
- For Application Password: verify the password is correct (no spaces)

### Prokip Login Issues

- Verify your Prokip username and password
- Check `PROKIP_API` is set to `https://api.prokip.africa`
- Ensure your Prokip account has API access

---

## Production Deployment

### Environment Variables

Set these for production:

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@production-db:5432/prokip_integration
REDIRECT_URI=https://your-production-domain.com/connections/callback/shopify
```

### HTTPS Requirement

Shopify OAuth requires HTTPS. Options:
- Use a reverse proxy (Nginx, Caddy) with SSL
- Deploy to a platform with automatic SSL (Heroku, Railway, Render)
- Use ngrok for local development with HTTPS

### Database Backups

```bash
# Backup
pg_dump prokip_integration > backup.sql

# Restore
psql prokip_integration < backup.sql
```

---

## Support

For issues or questions:
1. Check the [Implementation Guide](IMPLEMENTATION_GUIDE.md) for technical details
2. Review the [Testing Guide](TESTING_GUIDE.md) for debugging
3. Check server logs for error messages




