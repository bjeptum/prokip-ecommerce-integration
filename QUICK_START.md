# Quick Start Guide - Testing in 5 Minutes

This is a condensed version of the full testing guide. Use this for quick testing.

---

## Prerequisites

- Node.js v18+
- PostgreSQL running
- Postman installed

---

## Step 1: Environment Setup (1 minute)

```bash
cd /home/strongestavenger/Brenda/Prokip/Engineering/prokip-ecommerce-integration/backend

# Install dependencies
npm install

# Setup database
npx prisma generate
npx prisma migrate deploy

# Verify .env has MOCK_MODE=true
grep MOCK_MODE .env
```

---

## Step 2: Start Servers (1 minute)

**Terminal 1 - Mock APIs:**
```bash
cd backend
node tests/mock-servers.js
```

**Terminal 2 - Backend:**
```bash
cd backend
npm start
```

**Verify:**
```bash
# Should return products list
curl http://localhost:4000/connector/api/product \
  -H "Authorization: Bearer mock_prokip_api_key_12345"

# Should return OK
curl http://localhost:3000/api/health
```

---

## Step 3: Import Postman Collection (30 seconds)

1. Open Postman
2. Import → File
3. Select: `/backend/tests/Postman-Collection.json`

---

## Step 4: Run Tests in Postman (2 minutes)

Execute in order:

1. **1. Authentication > Login**
   - Body: `{"username": "admin", "password": "password123"}`
   - Saves JWT automatically

2. **2. Prokip Configuration > Set Prokip Config**
   - Body: `{"apiKey": "mock_prokip_api_key_12345", "baseUrl": "http://localhost:4000/connector/api"}`

3. **3. Store Connections > Create Shopify Connection**
   - Body: `{"platform": "shopify", "storeUrl": "test-store.myshopify.com", "accessToken": "mock_shopify_access_token"}`

4. **3. Store Connections > Create WooCommerce Connection**
   - Body: `{"platform": "woocommerce", "storeUrl": "https://example.com", "consumerKey": "ck_mock_key", "consumerSecret": "cs_mock_secret"}`

5. **4. Product Setup > Get All Products**
   - Should return 3 Prokip + 2 Shopify + 2 WooCommerce products

6. **4. Product Setup > Push Products to Shopify**
   - Body: `{"connectionId": 1, "productIds": ["PROD-001", "PROD-002"]}`

7. **5. Sync Operations > Resume Sync**
   - Starts automatic sync

8. **6. Webhooks (Shopify) > Shopify Order Created Webhook**
   - Body: `{"id": 12345, "line_items": [{"sku": "PROD-001", "quantity": 2, "price": "25.00"}], "created_at": "2024-01-15T10:30:00Z"}`

---

## Step 5: Test Frontend (1 minute)

1. Open browser: `http://localhost:3000`
2. Login: `admin` / `password123`
3. Set Prokip config:
   - API Key: `mock_prokip_api_key_12345`
   - Base URL: `http://localhost:4000/connector/api`
4. Add Shopify connection (already created via Postman)
5. Click "Load Products" - should show 7 products
6. Select 2 products → Push to Shopify
7. Click "Pull Inventory from Prokip"
8. Test sync controls (Pause/Resume/Sync Now)

---

## Expected Results

✅ **All Postman tests pass (8/8)**  
✅ **Frontend loads successfully**  
✅ **Products load from all 3 sources**  
✅ **Push products works**  
✅ **Sync controls function**  
✅ **Webhooks process correctly**

---

## Troubleshooting

**Port already in use:**
```bash
lsof -i :4000
kill -9 <PID>
```

**Database connection failed:**
```bash
sudo systemctl restart postgresql
```

**401 Unauthorized in Postman:**
- Re-run Login request
- Check JWT token saved to collection variables

---

## Full Documentation

For detailed testing, see [TESTING_GUIDE.md](TESTING_GUIDE.md)

---

**Ready for production?** Set `MOCK_MODE=false` and add real API credentials.
