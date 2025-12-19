# 🚀 Cross-Platform Setup Guide

## ✅ Issue Resolved: Prisma Binary Compatibility

### Problem
Prisma Client was generated for Windows but needed to run on Linux (Debian), causing the error:
```
Prisma Client could not locate the Query Engine for runtime "debian-openssl-1.1.x"
```

### Solution
Updated `prisma/schema.prisma` to include multiple binary targets for cross-platform compatibility.

---

## 📋 Setup Instructions

### For ALL Platforms (Windows, Linux, macOS)

#### 1. Clone Repository
```bash
git clone https://github.com/bjeptum/prokip-ecommerce-integration.git
cd prokip-ecommerce-integration
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Generate Prisma Client (IMPORTANT!)
**Every developer must run this after cloning or pulling changes:**

```bash
# Windows (PowerShell or CMD)
npx prisma generate

# Linux/macOS (Terminal)
npx prisma generate
```

Or use the npm script:
```bash
npm run prisma:generate
```

This command:
- ✅ Downloads the correct Prisma engine binary for YOUR operating system
- ✅ Generates TypeScript types
- ✅ Creates the Prisma Client in `node_modules/@prisma/client`

#### 4. Run Database Migrations (First time only)
```bash
npx prisma migrate dev --name init
```

#### 5. Start Server
```bash
node server.js
```

Or using npm:
```bash
npm run dev
```

#### 6. Access Application
Open browser: http://localhost:3000

---

## 🔧 Cross-Platform Configuration

### Updated Schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-1.1.x", "debian-openssl-3.0.x", "windows", "darwin", "darwin-arm64"]
}
```

**What each target means:**
- `native` - Automatically detects your current OS
- `debian-openssl-1.1.x` - Debian/Ubuntu with OpenSSL 1.1 (older Linux)
- `debian-openssl-3.0.x` - Debian/Ubuntu with OpenSSL 3.0 (newer Linux)
- `windows` - Windows 10/11
- `darwin` - macOS Intel
- `darwin-arm64` - macOS Apple Silicon (M1/M2/M3)

---

## 🐛 Troubleshooting

### Error: "Prisma Client could not locate the Query Engine"

**Solution:**
```bash
# Delete generated files
rm -rf node_modules/@prisma/client
rm -rf node_modules/.prisma

# Regenerate
npx prisma generate
```

### Error: "Permission denied: node_modules/.bin/prisma"

**Linux/macOS Solution:**
```bash
chmod +x node_modules/.bin/prisma
npx prisma generate
```

**Windows Solution:**
Run as Administrator or use:
```powershell
node node_modules/prisma/build/index.js generate
```

### Error: "Port 3000 already in use"

**Linux/macOS:**
```bash
lsof -ti:3000 | xargs kill -9
```

**Windows (PowerShell):**
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
```

Or change port in `server.js`:
```javascript
const port = process.env.PORT || 3001; // Changed from 3000
```

### Error: "Unique constraint failed on platform"

This means a connection already exists. Check existing connections:
```bash
curl http://localhost:3000/api/connections
```

Or view database:
```bash
npx prisma studio
```

---

## 📦 Git Workflow for Team

### When Pulling Changes

**If `schema.prisma` was updated:**
```bash
git pull
npm install              # Install new dependencies
npx prisma generate      # Regenerate client for your OS
npx prisma migrate dev   # Apply new migrations
```

### What to Commit

✅ **DO commit:**
- `prisma/schema.prisma`
- `prisma/migrations/`
- `package.json`
- `package-lock.json`
- Application code

❌ **DO NOT commit:**
- `node_modules/` (already in .gitignore)
- `prisma/dev.db` (SQLite database file)
- `prisma/dev.db-journal`
- `.env` files with secrets

### Example .gitignore

```gitignore
# Dependencies
node_modules/

# Database
prisma/dev.db
prisma/dev.db-journal
*.db
*.db-journal

# Environment
.env
.env.local

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
```

---

## 🧪 Testing the Fix

### Test 1: Check Prisma Client
```bash
ls -la node_modules/@prisma/client/
```

Should show files like:
- `index.js`
- `index.d.ts`
- `libquery_engine-*.so.node` (Linux)
- `query_engine-*.dll.node` (Windows)
- `libquery_engine-*.dylib.node` (macOS)

### Test 2: Server Starts
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

## 🚀 Quick Commands Reference

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

## 💡 Best Practices

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

## ✅ Verification Checklist

Before pushing code, verify:

- [ ] `npm install` completes without errors
- [ ] `npx prisma generate` runs successfully
- [ ] Server starts without Prisma errors
- [ ] Can access http://localhost:3000
- [ ] API endpoints respond correctly
- [ ] No sensitive data in commits (.env, database files)
- [ ] Code works on your OS (Windows/Linux/macOS)

---

## 🎯 Summary

**The key to cross-platform compatibility:**

1. **Always run `npx prisma generate` after pulling changes**
2. **Never commit `node_modules/` or database files**
3. **Use `binaryTargets` in schema for multiple platforms**
4. **Each developer generates client for their OS**

This ensures the application runs smoothly on **Windows**, **Linux**, and **macOS**! 🚀

---

**Need Help?**

Open an issue on GitHub: https://github.com/bjeptum/prokip-ecommerce-integration/issues
