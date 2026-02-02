# WooCommerce Inventory Sync - Manual Test Instructions

## 🎯 OBJECTIVE
Verify that WooCommerce orders reduce Prokip stock exactly once and maintain consistency.

## 📋 PREREQUISITES

### 1. Database Connection
Ensure PostgreSQL is running on localhost:5433 with database `prokip_db`:
```bash
# Check if PostgreSQL is running
netstat -ano | findstr :5433

# If not running, start PostgreSQL service
```

### 2. Environment Configuration
Verify `.env` file has correct database URL:
```
DATABASE_URL=postgresql://prokip_user:StrongPass123@localhost:5433/prokip_db
```

### 3. Prokip Configuration
Ensure you have a working Prokip connection:
- Prokip API credentials configured
- Location ID set
- Authentication working

## 🧪 TESTING SCENARIOS

### Scenario 1: Processing Order (Should Reduce Stock)
```bash
# Start the server
cd backend
node src/app.js

# In another terminal, send test webhook:
curl -X POST http://localhost:3000/webhooks/woocommerce/inventory \
  -H "Content-Type: application/json" \
  -H "x-wc-webhook-topic: order.created" \
  -H "x-wc-webhook-source: https://test-store.com" \
  -d '{
    "id": 40001,
    "number": "40001",
    "status": "processing",
    "financial_status": "paid",
    "date_created": "2024-01-15T10:30:00",
    "total": "99.99",
    "line_items": [
      {
        "id": 1,
        "name": "Test Product 1",
        "variation_id": 1001,
        "product_id": 2001,
        "sku": "TEST-SKU-001",
        "quantity": 2,
        "price": "25.00",
        "total": "50.00"
      }
    ],
    "billing": {
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com"
    }
  }'
```

**Expected Result:**
- Status: 200
- Action: "processed"
- SalesLog created in database
- Prokip stock reduced by 2 units
- Response includes `salesLogId` and `prokipSellId`

### Scenario 2: Completed Order (Should Reduce Stock)
```bash
curl -X POST http://localhost:3000/webhooks/woocommerce/inventory \
  -H "Content-Type: application/json" \
  -H "x-wc-webhook-topic: order.updated" \
  -H "x-wc-webhook-source: https://test-store.com" \
  -d '{
    "id": 40002,
    "number": "40002",
    "status": "completed",
    "financial_status": "paid",
    "date_created": "2024-01-15T11:30:00",
    "total": "75.00",
    "line_items": [
      {
        "id": 2,
        "name": "Test Product 2",
        "variation_id": null,
        "product_id": 2002,
        "sku": "TEST-SKU-002",
        "quantity": 1,
        "price": "75.00",
        "total": "75.00"
      }
    ]
  }'
```

**Expected Result:**
- Status: 200
- Action: "processed"
- Stock reduced by 1 unit

### Scenario 3: Pending Order (Should Skip)
```bash
curl -X POST http://localhost:3000/webhooks/woocommerce/inventory \
  -H "Content-Type: application/json" \
  -H "x-wc-webhook-topic: order.created" \
  -H "x-wc-webhook-source: https://test-store.com" \
  -d '{
    "id": 40003,
    "number": "40003",
    "status": "pending",
    "financial_status": "pending",
    "date_created": "2024-01-15T12:30:00",
    "total": "50.00",
    "line_items": [
      {
        "id": 3,
        "name": "Test Product 3",
        "variation_id": 1003,
        "product_id": 2003,
        "sku": "TEST-SKU-003",
        "quantity": 1,
        "price": "50.00",
        "total": "50.00"
      }
    ]
  }'
```

**Expected Result:**
- Status: 200
- Action: "skipped"
- Reason: "Order status not eligible for stock reduction"
- No stock reduction

### Scenario 4: Idempotency Test (Duplicate Webhook)
```bash
# Send the same order twice
curl -X POST http://localhost:3000/webhooks/woocommerce/inventory \
  -H "Content-Type: application/json" \
  -H "x-wc-webhook-topic: order.created" \
  -H "x-wc-webhook-source: https://test-store.com" \
  -d '{
    "id": 40001,
    "number": "40001",
    "status": "processing",
    "financial_status": "paid",
    "date_created": "2024-01-15T10:30:00",
    "total": "99.99",
    "line_items": [
      {
        "id": 1,
        "name": "Test Product 1",
        "variation_id": 1001,
        "product_id": 2001,
        "sku": "TEST-SKU-001",
        "quantity": 2,
        "price": "25.00",
        "total": "50.00"
      }
    ]
  }'

# Wait 2 seconds, then send again
sleep 2

curl -X POST http://localhost:3000/webhooks/woocommerce/inventory \
  -H "Content-Type: application/json" \
  -H "x-wc-webhook-topic: order.created" \
  -H "x-wc-webhook-source: https://test-store.com" \
  -d '{
    "id": 40001,
    "number": "40001",
    "status": "processing",
    "financial_status": "paid",
    "date_created": "2024-01-15T10:30:00",
    "total": "99.99",
    "line_items": [
      {
        "id": 1,
        "name": "Test Product 1",
        "variation_id": 1001,
        "product_id": 2001,
        "sku": "TEST-SKU-001",
        "quantity": 2,
        "price": "25.00",
        "total": "50.00"
      }
    ]
  }'
```

**Expected Result:**
- First request: Action "processed"
- Second request: Action "skipped"
- Reason: "Order already processed"
- Stock only reduced once

## 🔍 VERIFICATION CHECKS

### 1. Database Verification
```sql
-- Check SalesLog entries
SELECT * FROM sales_logs WHERE order_id IN ('40001', '40002', '40003') ORDER BY created_at DESC;

-- Check stock deduction status
SELECT order_id, stock_deducted, prokip_sell_id, synced_at FROM sales_logs WHERE order_id = '40001';

-- Check for errors
SELECT * FROM sync_errors WHERE order_id IN ('40001', '40002', '40003') ORDER BY created_at DESC;
```

### 2. Prokip Verification
Check Prokip dashboard or API to verify:
- Stock levels reduced correctly
- Sales recorded with correct quantities
- Invoice numbers match (WOO-40001, WOO-40002)

### 3. Server Logs
Check server console for detailed logs:
- Webhook received
- Order status validation
- Product mapping
- Prokip API calls
- Success/failure messages

## 📊 SUCCESS CRITERIA

### ✅ Must Pass:
1. **Processing orders** reduce stock exactly once
2. **Completed orders** reduce stock exactly once
3. **Pending/cancelled orders** are skipped
4. **Duplicate webhooks** don't reduce stock twice
5. **Database records** created correctly
6. **Prokip integration** works without errors

### ⚠️ Edge Cases:
1. Orders without product identifiers are rejected
2. Invalid JSON returns 400 error
3. Missing order ID returns 400 error
4. Server errors are logged properly

## 🚨 TROUBLESHOOTING

### Database Connection Issues:
```bash
# Check PostgreSQL status
netstat -ano | findstr :5433

# Test database connection
psql -h localhost -p 5433 -U prokip_user -d prokip_db

# If connection fails, check DATABASE_URL in .env
```

### Prokip API Issues:
```bash
# Test Prokip connection
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.prokip.africa/connector/api/products

# Check Prokip configuration in database
SELECT * FROM prokip_configs WHERE user_id = YOUR_USER_ID;
```

### Webhook Issues:
```bash
# Check webhook endpoint health
curl http://localhost:3000/webhooks/woocommerce/inventory/health

# Check webhook test endpoint
curl http://localhost:3000/webhooks/woocommerce/inventory/test
```

## 📋 FINAL VERIFICATION

After running all tests:

1. **Stock Consistency**: WooCommerce stock = Prokip stock
2. **Idempotency**: No duplicate stock reductions
3. **Error Handling**: All errors logged and handled
4. **Performance**: Webhooks processed quickly (< 5 seconds)

## 🎉 DEPLOYMENT READY

If all tests pass:
1. ✅ Inventory sync is working correctly
2. ✅ Idempotency is implemented
3. ✅ Error handling is robust
4. ✅ Logging is comprehensive
5. ✅ Ready for production use

## 📞 SUPPORT

If issues occur:
1. Check server logs for detailed error messages
2. Verify database connection and schema
3. Confirm Prokip API credentials
4. Test with simple webhook payloads first
