# ⚠️ IMPORTANT: Cross-Platform Setup

## 🎯 Quick Start (Any OS)

```bash
# 1. Clone repository
git clone https://github.com/bjeptum/prokip-ecommerce-integration.git
cd prokip-ecommerce-integration

# 2. Run setup (automatically generates Prisma client for your OS)
npm run setup

# 3. Start server
npm start

# 4. Open browser
# Visit: http://localhost:3000
```

---

## 🔧 The Prisma Binary Issue (SOLVED ✅)

### What Was The Problem?

Prisma Client includes native binary files specific to each operating system. When code generated on **Windows** is run on **Linux** (or vice versa), you get this error:

```
Prisma Client could not locate the Query Engine for runtime "debian-openssl-1.1.x"
```

### The Solution

We configured `prisma/schema.prisma` to support **multiple platforms**:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-1.1.x", "debian-openssl-3.0.x", "windows", "darwin", "darwin-arm64"]
}
```

This means:
- ✅ Works on **Windows** 10/11
- ✅ Works on **Linux** (Ubuntu, Debian, etc.)
- ✅ Works on **macOS** (Intel & Apple Silicon)

---

## 📋 Essential Commands

### After Cloning / Pulling Changes

**ALWAYS run this if `schema.prisma` changed:**
```bash
npm run prisma:generate
```

This downloads the correct binary for YOUR operating system.

### First Time Setup

```bash
npm run setup
```

This runs:
1. `npm install` - Installs dependencies
2. `prisma generate` - Generates client for your OS
3. `prisma migrate dev` - Sets up database

### Daily Development

```bash
# Start server
npm start

# View database GUI
npm run prisma:studio

# Create new migration
npm run prisma:migrate

# Reset database (⚠️ deletes all data)
npm run prisma:reset
```

---

## 🔄 Team Workflow

### Developer on Windows

```powershell
git pull
npm install
npm run prisma:generate  # Downloads Windows binary
npm start
```

### Developer on Linux

```bash
git pull
npm install
npm run prisma:generate  # Downloads Linux binary
npm start
```

### Developer on macOS

```bash
git pull
npm install
npm run prisma:generate  # Downloads macOS binary
npm start
```

**Key Point:** Each developer generates the client for **their own OS**. The generated files are NOT committed to git (they're in `node_modules/`).

---

## 🐛 Troubleshooting

### Issue: "Prisma engine not found"

```bash
# Solution 1: Regenerate client
rm -rf node_modules/@prisma
npm run prisma:generate

# Solution 2: Clean install
rm -rf node_modules
npm install
```

### Issue: "Permission denied" (Linux/macOS)

```bash
chmod +x node_modules/.bin/prisma
npm run prisma:generate
```

### Issue: "Port 3000 in use"

**Linux/macOS:**
```bash
lsof -ti:3000 | xargs kill -9
npm start
```

**Windows:**
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
npm start
```

---

## ✅ Verification

Test that everything works:

```bash
# 1. Server starts
npm start
# Expected: "Server running at http://localhost:3000"

# 2. API responds
curl http://localhost:3000/api/connections
# Expected: [] or array of connections

# 3. Can connect store
curl "http://localhost:3000/connect/shopify?location=test"
# Expected: Redirect or 200 status
```

---

## 📚 More Details

See [SETUP.md](./SETUP.md) for comprehensive documentation.

---

## 🎉 Summary

**For cross-platform compatibility:**

1. ✅ **Schema configured** with multiple `binaryTargets`
2. ✅ **`postinstall` script** automatically runs `prisma generate`
3. ✅ **Each developer** generates client for their OS
4. ✅ **Works on Windows, Linux, and macOS**

**You're all set!** 🚀
