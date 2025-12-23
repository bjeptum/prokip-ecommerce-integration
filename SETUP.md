# Prokip E-commerce Integration - Complete Setup Guide

## Overview

This guide covers the complete setup process for the Prokip E-commerce Integration system - a production-ready application built with **Express.js**, **Prisma ORM**, and **PostgreSQL** that connects Shopify and WooCommerce stores with real-time inventory synchronization.

### Architecture Summary
- **Backend**: Express.js + Prisma + PostgreSQL
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Authentication**: JWT-based with bcrypt
- **Background Jobs**: node-cron for periodic sync
- **APIs**: Shopify OAuth, WooCommerce REST API, Prokip API

## Issue Resolved: Prisma Binary Compatibility

### Problem
Prisma Client was generated for Windows but needed to run on Linux (Debian), causing the error:
```
Prisma Client could not locate the Query Engine for runtime "debian-openssl-1.1.x"
```

### Solution
Updated `backend/prisma/schema.prisma` to include multiple binary targets for cross-platform compatibility.


## Complete Setup Instructions

### Prerequisites
- **Node.js** v16 or higher ([Download](https://nodejs.org))
- **PostgreSQL** 12 or higher ([Download](https://www.postgresql.org/download/))
- **Git** for version control
- A text editor (VS Code, Sublime, etc.)


### For ALL Platforms (Windows, Linux, macOS)

#### Step 1: Clone Repository
```bash
git clone https://github.com/bjeptum/prokip-ecommerce-integration.git
cd prokip-ecommerce-integration
```

#### Step 2: Setup PostgreSQL Database

**Start PostgreSQL Service:**
```bash
# On Ubuntu/Debian
sudo systemctl start postgresql
sudo systemctl enable postgresql

# On macOS (with Homebrew)
brew services start postgresql

# On Windows
# Use Services app or pg_ctl start
```

**Create Database:**
```bash
# Connect as postgres user
sudo -u postgres psql

# Inside psql terminal, run:
CREATE DATABASE prokip_integration;

# Exit
\q
```

**Set PostgreSQL Password (if needed):**
```bash
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'prokip123';"
```

#### Step 3: Configure Backend

**Navigate to backend directory:**
```bash
cd backend
```

**Install Dependencies:**
```bash
npm install
```

**Configure Environment Variables:**
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your settings
nano .env  # or use your preferred editor
```

**Important `.env` variables:**
```dotenv
# Database connection
DATABASE_URL=postgresql://postgres:prokip123@localhost:5432/prokip_integration?schema=public

# Server configuration
PORT=3000
NODE_ENV=development

# Shopify OAuth (get from Shopify Partner Dashboard)
SHOPIFY_CLIENT_ID=your_shopify_api_key
SHOPIFY_CLIENT_SECRET=your_shopify_api_secret
REDIRECT_URI=http://localhost:3000/connections/callback/shopify

# Prokip API
PROKIP_API=https://api.prokip.africa

# JWT secret (generate a random strong string)
JWT_SECRET=your_very_strong_jwt_secret_change_this
```

#### Step 4: Generate Prisma Client (IMPORTANT!)
**Every developer must run this after cloning or pulling changes:**

```bash
# Generate Prisma Client for your OS
npm run prisma:generate
```

This command:
- Downloads the correct Prisma engine binary for YOUR operating system
- Generates TypeScript types
- Creates the Prisma Client in `node_modules/@prisma/client`

#### Step 5: Run Database Migrations
```bash
# Push schema to PostgreSQL and create tables
npm run prisma:migrate
```

This creates all necessary tables:
- `User` - Authentication
- `Connection` - Store configurations
- `InventoryCache` - SKU-level inventory
- `SalesLog` - Audit trail
- `ProkipConfig` - Prokip API credentials

#### Step 6: Start Server
```bash
# Start the backend server
npm start
```

Expected output:
```
Backend server running on http://localhost:3000
```

#### Step 7: Access Application
Open your browser and navigate to:
```
http://localhost:3000
```

**First-time usage:**
1. Register an account at `/login.html`
2. Login with your credentials
3. Configure Prokip API credentials
4. Connect your Shopify or WooCommerce stores

---

## Cross-Platform Configuration

### Prisma Schema Configuration (`backend/prisma/schema.prisma`)

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-1.1.x", "debian-openssl-3.0.x", "windows", "darwin", "darwin-arm64"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**What each binary target means:**
- `native` - Automatically detects your current OS
- `debian-openssl-1.1.x` - Debian/Ubuntu with OpenSSL 1.1 (older Linux distributions)
- `debian-openssl-3.0.x` - Debian/Ubuntu with OpenSSL 3.0 (newer Linux distributions)
- `windows` - Windows 10/11
- `darwin` - macOS Intel processors
- `darwin-arm64` - macOS Apple Silicon (M1/M2/M3)

**Why multiple targets?**
This ensures developers on different operating systems can generate Prisma Client without compatibility issues. When you run `npm run prisma:generate`, Prisma downloads binaries for all specified targets.

---

## Troubleshooting

### Error: "Prisma Client could not locate the Query Engine"

**Cause:** Prisma Client generated on a different OS than the one running the application.

**Solution:**
```bash
cd backend

# Delete generated Prisma files
rm -rf node_modules/@prisma/client
rm -rf node_modules/.prisma

# Regenerate for your OS
npm run prisma:generate
```

### Error: "Permission denied: node_modules/.bin/prisma"

**Linux/macOS Solution:**
```bash
cd backend
chmod +x node_modules/.bin/prisma
npx prisma generate
```

**Windows Solution:**
Run terminal as Administrator or use:
```powershell
cd backend
node node_modules/prisma/build/index.js generate
```

### Error: "Port 3000 already in use"

**Linux/macOS:**
```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

**Windows (PowerShell):**
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
```

**Or change port in `.env`:**
```dotenv
PORT=3001
```

### Error: "Can't reach database server at localhost:5432"

**Solution:**
```bash
# Check PostgreSQL service status
sudo systemctl status postgresql  # Linux
brew services list  # macOS

# Start PostgreSQL if not running
sudo systemctl start postgresql  # Linux
brew services start postgresql   # macOS
```

### Error: "Database 'prokip_integration' does not exist"

**Solution:**
```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database
CREATE DATABASE prokip_integration;

# Exit
\q

# Run migrations
cd backend
npm run prisma:migrate
```

### Error: "Invalid JWT token" or 401 Unauthorized

**Solution:**
```bash
# Ensure JWT_SECRET is set in backend/.env
JWT_SECRET=your_very_strong_secret_key_change_this

# Restart server
cd backend
npm start
```


### Error: "Unique constraint failed on storeUrl"

**Cause:** A connection with the same store URL already exists in the database.

**Solution:**
```bash
# View existing connections via API
curl http://localhost:3000/connections

# Or view database in Prisma Studio
cd backend
npx prisma studio
```

If you need to remove the duplicate:
```bash
# In Prisma Studio, delete the duplicate connection
# Or use SQL:
sudo -u postgres psql -d prokip_integration
DELETE FROM "Connection" WHERE "storeUrl" = 'https://yourstore.myshopify.com';
```

---

## Git Workflow for Team

### When Pulling Changes

**If `backend/prisma/schema.prisma` was updated:**
```bash
git pull

# Navigate to backend
cd backend

# Install new dependencies
npm install

# Regenerate Prisma Client for your OS
npm run prisma:generate

# Apply new migrations
npm run prisma:migrate
```

**If only application code changed:**
```bash
git pull
cd backend
npm install  # Only if package.json changed
npm start
```

### Example .gitignore

```gitignore
# Dependencies
node_modules/
backend/node_modules/

# Environment variables
.env
.env.local
.env.*.local
backend/.env

# Prisma generated files (auto-generated)
backend/node_modules/.prisma/
backend/node_modules/@prisma/

# OS files
.DS_Store
Thumbs.db
*.swp
*.swo

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Editor directories
.vscode/
.idea/
*.sublime-project
*.sublime-workspace
# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Editor directories
.vscode/
.idea/
*.sublime-project
*.sublime-workspace
```

---

## Testing Your Setup

### 1. Test Backend Server
```bash
cd backend
npm start
```

Expected output:
```
Backend server running on http://localhost:3000
```

### 2. Test Database Connection
```bash
cd backend
npx prisma studio
```

This opens Prisma Studio at `http://localhost:5555` where you can view database tables.

### 3. Test API Endpoints

**Register a user:**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}'
```

Expected response:
```json
{"message": "User registered successfully"}
```

**Login:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}'
```

Expected response:
```json
{"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
```

**Get connections (requires auth token):**
```bash
curl http://localhost:3000/connections \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 4. Test Frontend
1. Open browser: `http://localhost:3000`
2. Navigate to login page
3. Register and login
4. Configure Prokip credentials
5. Connect a test store

---

## Useful Commands Reference

### Prisma Commands
```bash
cd backend

# Generate Prisma Client
npm run prisma:generate

# Create and apply migrations
npm run prisma:migrate

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio

# Format schema file
npx prisma format

# Validate schema
npx prisma validate
```

### PostgreSQL Commands
```bash
# Connect to database
sudo -u postgres psql -d prokip_integration

# List all tables
\dt

# Describe table structure
\d "Connection"

# View data
SELECT * FROM "Connection";

# Exit
\q
```

### NPM Scripts (in backend/)
```bash
npm start              # Start server
npm run prisma:generate # Generate Prisma Client
npm run prisma:migrate  # Run migrations
```

---

##  Next Steps

1. **Configure Shopify App** (if using Shopify):
   - Go to [Shopify Partner Dashboard](https://partners.shopify.com)
   - Create a new app
   - Set redirect URL: `http://localhost:3000/connections/callback/shopify`
   - Copy API key and secret to `backend/.env`

2. **Configure WooCommerce** (if using WooCommerce):
   - Go to your WooCommerce store admin
   - Navigate to: WooCommerce → Settings → Advanced → REST API
   - Create new API keys with Read/Write permissions
   - Copy consumer key and secret for connection

3. **Configure Prokip API**:
   - Login to the application
   - Navigate to setup page
   - Enter Prokip API token and location ID
   - Save configuration

4. **Test Synchronization**:
   - Connect a store
   - Trigger manual sync
   - Check logs for successful inventory updates
   - Verify data in Prisma Studio

---

## Tips for Development

1. **Use Prisma Studio for debugging**: `npx prisma studio`
2. **Check server logs** for detailed error messages
3. **Run migrations after schema changes**: `npm run prisma:migrate`
4. **Always regenerate after git pull**: `npm run prisma:generate`
5. **Keep `.env` file secure** - never commit it
6. **Test API endpoints with curl** before UI integration
7. **Use PostgreSQL GUI tools** like pgAdmin for advanced database management

---

## Support & Resources

- **Prisma Documentation**: https://www.prisma.io/docs
- **Express.js Guide**: https://expressjs.com/
- **PostgreSQL Manual**: https://www.postgresql.org/docs/
- **Shopify API Reference**: https://shopify.dev/api
- **WooCommerce REST API**: https://woocommerce.github.io/woocommerce-rest-api-docs/

---

**Last Updated**: December 2025  
**Version**: 2.0.0 (PostgreSQL + Express.js + Prisma)

```bash
node server.js
```

Expected output:
```
Server running at http://localhost:3000
```

No Prisma errors!

### Test 3: API Works
```bash
curl http://localhost:3000/api/connections
```

Expected: `[]` or array of connections

### Test 4: Database Operations
```bash
# Connect a store
curl "http://localhost:3000/connect/shopify?location=location1"

# Check connections
curl http://localhost:3000/api/connections
```

Should return Shopify connection.

---

## Quick Commands Reference

### Development Commands

```bash
# Install dependencies
npm install

# Generate Prisma Client (run after schema changes)
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Start server
npm run dev
# or
node server.js

# View database (GUI)
npx prisma studio

# Format schema file
npx prisma format

# Check schema for errors
npx prisma validate
```

### Database Commands

```bash
# Create new migration
npx prisma migrate dev --name <migration-name>

# Reset database (⚠️ deletes all data)
npx prisma migrate reset

# View database in browser
npx prisma studio

# Direct SQL query
sqlite3 prisma/dev.db "SELECT * FROM Connection;"
```

### Testing Commands

```bash
# Test server is running
curl http://localhost:3000

# Test API
curl http://localhost:3000/api/connections

# Test webhook (simulate sale)
curl -X POST http://localhost:3000/webhook/shopify \
  -H "Content-Type: application/json" \
  -d '{"orderId":"TEST-001","sku":"shirt1","quantity":5,"status":"completed"}'
```

---

##  Best Practices

### For Windows Users

1. **Use PowerShell or Windows Terminal** (not CMD)
2. **Run as Administrator** if you get permission errors
3. **Enable Developer Mode** in Windows Settings
4. **Use WSL2** for better Linux compatibility (optional but recommended)

### For Linux Users

1. **Update permissions** after npm install:
   ```bash
   chmod +x node_modules/.bin/*
   ```
2. **Check OpenSSL version**:
   ```bash
   openssl version
   ```
3. **Use Node Version Manager (nvm)** for consistent Node.js versions

### For macOS Users

1. **Install Homebrew** for package management
2. **Use latest Node.js LTS** version
3. **For M1/M2/M3 Macs**: Ensure Rosetta 2 is installed if needed

---

## 📚 Additional Resources

- [Prisma Binary Targets Docs](https://www.prisma.io/docs/concepts/components/prisma-engines/query-engine#the-query-engine-at-runtime)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Node.js Documentation](https://nodejs.org/docs/latest/api/)

---

## Verification Checklist

Before pushing code, verify:

- [ ] `npm install` completes without errors
- [ ] `npx prisma generate` runs successfully
- [ ] Server starts without Prisma errors
- [ ] Can access http://localhost:3000
- [ ] API endpoints respond correctly
- [ ] No sensitive data in commits (.env, database files)
- [ ] Code works on your OS (Windows/Linux/macOS)

---

## Summary

**The key to cross-platform compatibility:**

1. **Always run `npx prisma generate` after pulling changes**
2. **Never commit `node_modules/` or database files**
3. **Use `binaryTargets` in schema for multiple platforms**
4. **Each developer generates client for their OS**

This ensures the application runs smoothly on **Windows**, **Linux**, and **macOS**!


