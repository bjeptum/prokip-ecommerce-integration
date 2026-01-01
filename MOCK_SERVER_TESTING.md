# Understanding the Mock Server Errors

## What's Happening

You're getting these errors because you're testing the wrong endpoints or with wrong credentials:

### ❌ Port 4000: `{"error":"Unauthenticated."}`
**Problem:** You're missing the Authorization header  
**Solution:** You must include `Authorization: Bearer mock_prokip_api_key_12345`

### ❌ Port 4001: `Cannot GET /`
**Problem:** You're accessing the root path `/` which doesn't exist  
**Solution:** Use the correct Shopify API path: `/admin/api/2026-01/products.json`

### ❌ Port 4002: `{"code":"rest_not_logged_in","message":"Unauthorized"}`
**Problem:** You're missing Basic Authentication credentials  
**Solution:** You must include Basic Auth: `ck_mock_key:cs_mock_secret`

---

## Correct Testing Commands

### Test Mock Prokip API (Port 4000)

**✅ Correct:**
```bash
curl http://localhost:4000/connector/api/product \
  -H "Authorization: Bearer mock_prokip_api_key_12345" \
  -H "Accept: application/json"
```

**Expected Response:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Wireless Mouse",
      "sku": "WM-001",
      ...
    }
  ]
}
```

---

### Test Mock Shopify API (Port 4001)

**❌ Wrong:**
```bash
curl http://localhost:4001/
# Returns: Cannot GET /
```

**✅ Correct:**
```bash
curl http://localhost:4001/admin/api/2026-01/products.json \
  -H "X-Shopify-Access-Token: mock_shopify_access_token" \
  -H "Accept: application/json"
```

**Expected Response:**
```json
{
  "products": [
    {
      "id": 1,
      "title": "T-Shirt",
      "variants": [...]
    }
  ]
}
```

---

### Test Mock WooCommerce API (Port 4002)

**✅ Correct:**
```bash
curl http://localhost:4002/wp-json/wc/v3/products \
  -u "ck_mock_key:cs_mock_secret" \
  -H "Accept: application/json"
```

**Expected Response:**
```json
[
  {
    "id": 1,
    "name": "Leather Wallet",
    "sku": "WOO-001",
    ...
  }
]
```

---

## Quick Copy-Paste Commands

Run these one by one to test each mock server:

```bash
# 1. Test Prokip API
curl http://localhost:4000/connector/api/product \
  -H "Authorization: Bearer mock_prokip_api_key_12345"

# 2. Test Shopify API  
curl http://localhost:4001/admin/api/2026-01/products.json \
  -H "X-Shopify-Access-Token: mock_shopify_access_token"

# 3. Test WooCommerce API
curl http://localhost:4002/wp-json/wc/v3/products \
  -u "ck_mock_key:cs_mock_secret"

# 4. Test Backend Login
curl http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"securepassword123"}'
```

---

## Using in Browser

You **cannot test these directly in browser** because:
- Browsers don't send custom headers by default
- You can't set Authorization headers from the URL bar
- Basic Auth in browser requires different format

**Instead, use:**
- **Postman** (recommended)
- **curl** in terminal
- **Your frontend** (which sends proper headers)

---

## Postman Testing

### Updated Credentials

I've updated the Postman collection with your password. Re-import it:

**File:** `/backend/tests/Postman-Collection.json`

**Login credentials:**
- Username: `admin`
- Password: `securepassword123` ✅ (updated)

### Testing Flow in Postman:

1. **Login** → `1. Authentication > Login`
   - Auto-saves JWT token

2. **Set Prokip Config** → `2. Prokip Configuration > Set Prokip Config`
   - Body already has correct credentials

3. **Create Shopify Connection** → `3. Store Connections > Create Shopify Connection`
   - Uses mock credentials

4. **Get Products** → `4. Product Setup > Get All Products`
   - Should return 7 products

---

## Summary

### What You Were Doing (Wrong)
- Accessing `http://localhost:4000/` directly (missing path and auth)
- Accessing `http://localhost:4001/` directly (wrong path)
- Accessing `http://localhost:4002/` directly (missing auth)

### What You Should Do (Correct)
- Use **full API paths** (not just the root)
- Include **proper authentication headers**
- Use **Postman** or **curl** (not browser directly)

---

## Password Updated

✅ I've updated these files with your password `securepassword123`:
- `/backend/.env`
- `/backend/tests/Postman-Collection.json`

You can now re-import the Postman collection and all tests should work!

---

## Need Help?

If servers aren't running, start them:

```bash
# Terminal 1: Mock Servers
cd /home/strongestavenger/Brenda/Prokip/Engineering/prokip-ecommerce-integration/backend
node tests/mock-servers.js

# Terminal 2: Backend
cd /home/strongestavenger/Brenda/Prokip/Engineering/prokip-ecommerce-integration/backend
npm start
```

Then use Postman or the curl commands above! 🚀
