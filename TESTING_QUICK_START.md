# Quick Start Testing Guide

## Prerequisites

1. PostgreSQL database running
2. Node.js 16+ installed
3. Shopify Partner account (for Shopify testing)
4. Local WooCommerce instance (optional, for Woo testing)

## Setup

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 3. Run migrations
npx prisma migrate dev

# 4. Start backend
npm start
# Backend runs on http://localhost:3000
```

## Testing Workflow

### 1. Login
- Open http://localhost:3000
- Use credentials from .env: `DEFAULT_ADMIN_USER` and `DEFAULT_ADMIN_PASS`
- Select a business location

### 2. Connect Shopify Store

**Option A: Real Shopify Store**
1. Go to Settings
2. Click "Connect Shopify"
3. Enter your store URL (e.g., `mystore.myshopify.com`)
4. Click "Connect Store"
5. Approve on Shopify's site
6. You'll be redirected back with success message

**Option B: Development Store (Recommended)**
1. Create development store at partners.shopify.com
2. Follow same steps as Option A

### 3. Connect WooCommerce Store

**Option A: Local WooCommerce**
```bash
# Quick Docker setup
docker run -p 8080:80 \
  -e WORDPRESS_DB_HOST=db:3306 \
  -e WORDPRESS_DB_USER=wordpress \
  -e WORDPRESS_DB_PASSWORD=wordpress \
  woocommerce/woocommerce
```

1. Go to Settings
2. Click "Connect WooCommerce"
3. Enter store URL: `http://localhost:8080`
4. Enter consumer key and secret (from WP Admin → WooCommerce → Settings → Advanced → REST API)
5. Click "Connect Store"

**Option B: Mock Mode**
Set in .env:
```env
MOCK_WOO=true
MOCK_WOO_URL=http://localhost:4002
```

Then run the mock server:
```bash
cd backend/tests
node mock-servers.js
```

### 4. Test Product Setup Flow

**Test Pull (Store → Prokip):**
1. Add products to your Shopify/WooCommerce store first
2. On Dashboard, find your store card
3. Click "Setup Products"
4. Select "Use products from my online store"
5. Review matches in the modal
6. Click "Confirm & Continue"
7. Wait for import to complete
8. Check Products page to verify

**Test Push (Prokip → Store):**
1. Create products in Prokip first (use Prokip Operations page)
2. On Dashboard, find your store card
3. Click "Setup Products"
4. Select "Use products from Prokip"
5. Review readiness checklist
6. If issues exist, fix in Prokip
7. Click "Publish to Store"
8. Wait for publish to complete
9. Check store to verify products created

### 5. Test Sales Sync

**Shopify:**
1. Create test order in Shopify
2. Mark as paid
3. Check terminal logs for webhook received
4. Verify sale in Prokip (check via API or Prokip dashboard)
5. Check inventory reduced

**WooCommerce:**
1. Create test order in WooCommerce
2. Mark as completed
3. Check terminal logs for webhook received
4. Verify sale in Prokip
5. Check inventory reduced

### 6. Test Refund

1. Refund an order in Shopify/WooCommerce
2. Check terminal logs for refund webhook
3. Verify inventory restored
4. Check SalesLog for refund entry

### 7. Test Sync Errors

**Generate an Error:**
1. Create order with invalid SKU (not in Prokip)
2. Webhook will fail
3. Error logged to SyncError table

**View & Resolve:**
1. Go to Settings
2. Click "View Sync Errors"
3. See the error listed
4. Fix the issue (add product with matching SKU)
5. Click "Mark Resolved"
6. Error is marked as resolved

### 8. Test Disconnect

1. Go to Settings
2. Find a connected store
3. Click "Disconnect"
4. Confirm action
5. Verify store removed from dashboard
6. Verify data cleaned up in database

## Verifying Database

```bash
# Connect to PostgreSQL
psql $DATABASE_URL

# Check connections
SELECT * FROM "Connection";

# Check inventory cache
SELECT * FROM "InventoryCache";

# Check sales log
SELECT * FROM "SalesLog";

# Check sync errors
SELECT * FROM "SyncError" WHERE resolved = false;
```

## API Testing (Postman/cURL)

### Get Product Matches
```bash
curl -X GET "http://localhost:3000/setup/products/matches?connectionId=1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Readiness Check
```bash
curl -X POST "http://localhost:3000/setup/products/readiness-check" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"connectionId": 1}'
```

### Pull Products
```bash
curl -X POST "http://localhost:3000/setup/products" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"method": "pull", "connectionId": 1}'
```

### Push Products
```bash
curl -X POST "http://localhost:3000/setup/products" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"method": "push", "connectionId": 1}'
```

### Get Sync Errors
```bash
curl -X GET "http://localhost:3000/sync/errors" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Resolve Error
```bash
curl -X PATCH "http://localhost:3000/sync/errors/1/resolve" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Disconnect Store
```bash
curl -X DELETE "http://localhost:3000/connections/1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Troubleshooting

### Webhooks Not Received

**For Shopify:**
1. Ensure WEBHOOK_URL is publicly accessible (use ngrok for local testing)
2. Check webhook registration: GET /admin/api/2026-01/webhooks.json
3. Verify SHOPIFY_CLIENT_SECRET matches

**For WooCommerce:**
1. Check webhook configuration in WP Admin
2. Verify WEBHOOK_SECRET matches
3. Test with webhook tester tool

### OAuth Redirect Not Working

1. Verify REDIRECT_URI exactly matches in Shopify app settings
2. Check URL normalization is working
3. Ensure no trailing slashes

### Products Not Syncing

1. Check Prokip API is reachable (or MOCK_PROKIP=true)
2. Verify Prokip token is valid
3. Check locationId is set
4. Review terminal logs for errors

### Inventory Not Updating

1. Verify cron job is running (check logs every 5 minutes)
2. Check InventoryCache has entries
3. Verify store credentials are valid
4. Check syncEnabled is true

## Success Criteria

✅ Can connect Shopify store via OAuth  
✅ Can connect WooCommerce store via keys  
✅ Can setup products (pull or push)  
✅ Product matching works correctly  
✅ Readiness check identifies issues  
✅ Shopify order creates sale in Prokip  
✅ WooCommerce order creates sale in Prokip  
✅ Inventory syncs every 5 minutes  
✅ Refunds restore inventory  
✅ Cancellations restore inventory  
✅ Sync errors are logged and visible  
✅ Can resolve sync errors  
✅ Can disconnect store cleanly  

## Performance Benchmarks

- OAuth redirect: < 2 seconds
- Product matching (100 products): < 5 seconds
- Product pull (50 products): < 30 seconds
- Product push (50 products): < 30 seconds
- Webhook processing: < 500ms
- Inventory sync (10 stores, 100 SKUs): < 10 seconds

## Security Checklist

- [ ] HTTPS enabled for webhooks
- [ ] HMAC validation working for Shopify
- [ ] Signature validation working for WooCommerce
- [ ] JWT tokens expire properly
- [ ] Passwords hashed with bcrypt
- [ ] SQL injection protected (Prisma ORM)
- [ ] Rate limiting considered for production
- [ ] CORS configured properly

---

**Happy Testing! 🚀**

For issues or questions, check:
- COMPREHENSIVE_ANALYSIS.md for full feature details
- IMPLEMENTATION_SUMMARY.md for what was implemented
- Backend logs for debugging
