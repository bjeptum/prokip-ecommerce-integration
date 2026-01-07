# Testing Guide for Prokip Operations Feature

## Prerequisites

1. PostgreSQL database running
2. Environment variables configured in `/backend/.env`
3. Node.js and npm installed
4. Database migrations applied

## Quick Start

### 1. Start Mock Prokip Server (Terminal 1)

```bash
cd /home/strongestavenger/Brenda/Prokip/Engineering/prokip-ecommerce-integration/backend/tests
MOCK_PROKIP=true node mock-prokip-api.js
```

Expected output:
```
Mock Prokip API Server running on http://localhost:4000
```

### 2. Start Backend Server (Terminal 2)

```bash
cd /home/strongestavenger/Brenda/Prokip/Engineering/prokip-ecommerce-integration/backend
npm start
```

Expected output:
```
Server running on port 5000
```

### 3. Access Frontend

Open browser and navigate to:
- If using http-server: `http://localhost:3000` (start with `npx http-server -p 3000` in frontend/public)
- Or open `/frontend/public/index.html` directly in browser

## Test Scenarios

### Scenario 1: Create a Product

**Steps:**
1. Login with credentials (default: admin/password)
2. Select a business location
3. Click "Prokip Operations" in sidebar
4. Click "Create Product" button
5. Fill in the form:
   - Product Name: "Test T-Shirt"
   - SKU: "TSHIRT-001"
   - Sell Price: "29.99"
   - Purchase Price: "15.00"
   - Initial Quantity: "100"
   - Description: "Premium cotton t-shirt"
6. Click "Create Product"

**Expected Result:**
- Success message appears
- Results show:
  - ✓ Created in Prokip
  - ✓ Synced to [Store Name] (for each connected store)
  - Or error messages if store sync fails
- Modal closes after 3 seconds

**Verification:**
- Check mock Prokip server logs - should show POST /connector/api/product
- If Shopify/WooCommerce connected, check those stores for new product

### Scenario 2: Record a Sale

**Prerequisites:** At least one product created (use Scenario 1)

**Steps:**
1. In Prokip Operations page, click "Record Sale"
2. Fill in the form:
   - Customer Name: "John Doe" (optional)
   - Item 1:
     - SKU: "TSHIRT-001"
     - Quantity: "2"
     - Unit Price: "29.99"
   - Discount: "5.00" (optional)
3. Click "Add Item" if you want multiple items
4. Click "Record Sale"

**Expected Result:**
- Success message appears
- Results show:
  - ✓ Recorded in Prokip
  - ✓ Inventory updated in [Store Name] (for each connected store)
- Modal closes after 3 seconds

**Verification:**
- Check mock Prokip server logs - should show POST /connector/api/sell
- Inventory for SKU "TSHIRT-001" should be reduced by 2
- If stores connected, verify inventory decreased in Shopify/WooCommerce

### Scenario 3: Record a Purchase

**Prerequisites:** At least one product created

**Steps:**
1. In Prokip Operations page, click "Record Purchase"
2. Fill in the form:
   - Supplier Name: "Acme Supplies Inc."
   - Item 1:
     - SKU: "TSHIRT-001"
     - Quantity: "50"
     - Unit Cost: "12.50"
3. Click "Add Item" for multiple items if needed
4. Click "Record Purchase"

**Expected Result:**
- Success message appears
- Results show:
  - ✓ Recorded in Prokip
  - ✓ Inventory updated in [Store Name] (for each connected store)
- Modal closes after 3 seconds

**Verification:**
- Check mock Prokip server logs - should show POST /connector/api/purchase
- Inventory for SKU "TSHIRT-001" should be increased by 50
- If stores connected, verify inventory increased in Shopify/WooCommerce

### Scenario 4: Multiple Line Items

**Steps:**
1. Open "Record Sale" modal
2. Add first item (SKU: TSHIRT-001, Qty: 2, Price: 29.99)
3. Click "Add Item" button
4. Add second item (SKU: PANTS-001, Qty: 1, Price: 49.99)
5. Click "Add Item" again
6. Add third item (SKU: HAT-001, Qty: 3, Price: 15.99)
7. Set discount: 10.00
8. Click "Record Sale"

**Expected Result:**
- All three items processed
- Inventory reduced for each SKU
- Total calculated correctly with discount

### Scenario 5: Error Handling - Invalid SKU

**Steps:**
1. Open "Record Sale" modal
2. Enter SKU that doesn't exist: "INVALID-SKU"
3. Set Quantity: 1, Price: 10.00
4. Click "Record Sale"

**Expected Result:**
- Error message displayed
- Operation fails gracefully
- Details show which store failed and why

### Scenario 6: Error Handling - Missing Required Fields

**Steps:**
1. Open "Create Product" modal
2. Leave SKU field empty
3. Fill other fields
4. Click "Create Product"

**Expected Result:**
- Error notification: "Please fill in all required fields"
- Form not submitted
- Modal remains open

### Scenario 7: Dynamic Item Management

**Steps:**
1. Open "Record Sale" modal
2. Click "Add Item" 3 times (should have 4 items total)
3. Click delete button on 2nd item
4. Verify only 3 items remain
5. Try to delete when only 1 item remains

**Expected Result:**
- Items can be added dynamically
- Delete button works for multiple items
- Delete button disabled when only 1 item remains
- Grid layout adjusts properly

### Scenario 8: Verify Existing Features Still Work

**Shopify Connection:**
1. Go to Settings page
2. Click "Connect Shopify"
3. Enter Shopify store URL
4. Complete OAuth flow

**Expected:** Connection successful, webhooks registered

**WooCommerce Connection:**
1. Go to Settings page
2. Click "Connect WooCommerce"
3. Enter store URL and API credentials
4. Connect

**Expected:** Connection successful

**Webhook Processing:**
- Create order in Shopify/WooCommerce
- Verify webhook received and processed
- Check sync logs

## API Testing with cURL

### Create Product
```bash
# Get auth token first
TOKEN=$(curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' \
  | jq -r '.token')

# Create product (replace LOCATION_ID with actual ID)
curl -X POST http://localhost:5000/prokip/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Test Product",
    "sku": "API-TEST-001",
    "sellPrice": 99.99,
    "purchasePrice": 50.00,
    "quantity": 25,
    "description": "Created via API",
    "locationId": "LOCATION_ID"
  }'
```

### Record Sale
```bash
curl -X POST http://localhost:5000/prokip/sales \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "API Test Customer",
    "items": [
      {
        "sku": "API-TEST-001",
        "quantity": 2,
        "price": 99.99
      }
    ],
    "discount": 10.00,
    "locationId": "LOCATION_ID"
  }'
```

### Record Purchase
```bash
curl -X POST http://localhost:5000/prokip/purchases \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "supplierName": "API Test Supplier",
    "items": [
      {
        "sku": "API-TEST-001",
        "quantity": 50,
        "cost": 45.00
      }
    ],
    "locationId": "LOCATION_ID"
  }'
```

## Database Verification

### Check Created Products (in mock server memory)
```bash
# Query mock server (it uses in-memory storage)
# Products are logged to console when created
```

### Check InventoryCache
```bash
cd /home/strongestavenger/Brenda/Prokip/Engineering/prokip-ecommerce-integration/backend
npx prisma studio
```

Navigate to InventoryCache table and verify:
- Records created for each product/connection combination
- Quantities updated after sales/purchases
- No duplicate (connectionId, sku) pairs

## Troubleshooting

### Issue: Modal doesn't open
**Solution:** 
- Check browser console for JavaScript errors
- Verify script.js is loaded
- Check if closeModal() is properly closing modals

### Issue: "Please fill in all required fields"
**Solution:**
- Ensure all fields marked with * are filled
- Check that numeric fields contain valid numbers
- Verify SKU doesn't have spaces or special characters

### Issue: Sync fails to stores
**Solution:**
- Check if stores are actually connected (Settings page)
- Verify store API credentials are correct
- Check store API rate limits
- Review backend logs for detailed error messages

### Issue: "Product not found" error in sale/purchase
**Solution:**
- Ensure product exists in Prokip first
- Verify SKU matches exactly (case-sensitive)
- Check that product has been synced to the store

### Issue: Migration fails
**Solution:**
- Run cleanup script: `node cleanup-duplicates.js`
- Re-run migration: `npx prisma migrate dev`
- Check database connection

## Performance Testing

### Test with Multiple Items
Create a sale with 10+ line items to test:
- Form rendering performance
- API request handling
- Database transaction performance

### Test with Multiple Stores
Connect 2-3 stores and create a product to verify:
- Parallel sync operations
- Error isolation (one store fails, others succeed)
- Response time

## Success Criteria

✅ All modals open and close properly
✅ Form validation works correctly
✅ Products created in Prokip successfully
✅ Products synced to all connected stores
✅ Sales reduce inventory correctly
✅ Purchases increase inventory correctly
✅ Multiple line items handled properly
✅ Error messages clear and helpful
✅ Existing Shopify/WooCommerce integrations still work
✅ Database constraints enforced
✅ No JavaScript errors in browser console
✅ No unhandled exceptions in backend logs

## Next Steps

After successful testing:
1. Review PROKIP_OPERATIONS_FEATURE.md for implementation details
2. Test with real Shopify/WooCommerce stores (set MOCK_PROKIP=false)
3. Monitor production logs for any issues
4. Gather user feedback for improvements
5. Consider implementing suggested future enhancements

## Support

For issues or questions:
1. Check backend logs in Terminal 2
2. Check mock Prokip server logs in Terminal 1
3. Check browser console for frontend errors
4. Review error messages in operation result panels
5. Verify database state using Prisma Studio
