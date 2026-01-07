# Prokip Operations Feature

## Overview
Added new functionality to allow users to create products, record sales, and record purchases directly in Prokip with automatic synchronization to all connected Shopify and WooCommerce stores.

## Features Implemented

### 1. Create Products in Prokip
- **Endpoint**: `POST /prokip/products`
- **Functionality**: 
  - Creates a new product in Prokip inventory
  - Automatically syncs the product to all connected stores (Shopify & WooCommerce)
  - Updates inventory cache for each connection
- **UI**: New "Prokip Operations" page with "Create Product" modal
- **Fields**:
  - Product Name (required)
  - SKU (required, unique)
  - Sell Price (required)
  - Purchase Price (required)
  - Initial Quantity (required)
  - Description (optional)

### 2. Record Sales in Prokip
- **Endpoint**: `POST /prokip/sales`
- **Functionality**:
  - Records a sale transaction in Prokip
  - Reduces inventory in all connected stores
  - Supports multiple line items
  - Handles discounts
- **UI**: "Record Sale" modal with dynamic item rows
- **Fields**:
  - Customer Name (optional)
  - Sale Items (SKU, Quantity, Unit Price) - can add multiple
  - Discount (optional)

### 3. Record Purchases in Prokip
- **Endpoint**: `POST /prokip/purchases`
- **Functionality**:
  - Records an inventory purchase from suppliers
  - Increases inventory in all connected stores
  - Supports multiple line items
- **UI**: "Record Purchase" modal with dynamic item rows
- **Fields**:
  - Supplier Name (required)
  - Purchase Items (SKU, Quantity, Unit Cost) - can add multiple

## Technical Implementation

### Backend Changes

#### 1. New Route: `/backend/src/routes/prokipRoutes.js`
```javascript
- POST /prokip/products - Create product and sync to stores
- POST /prokip/sales - Record sale and update store inventory
- POST /prokip/purchases - Record purchase and update store inventory
```

Each operation:
1. Validates input data
2. Performs operation in Prokip (via mock API or real API)
3. Retrieves all connections for the user's business location
4. Syncs changes to each connected store
5. Updates InventoryCache for tracking
6. Returns detailed results showing success/failure per store

#### 2. Database Migration
Added unique constraint to InventoryCache:
```prisma
model InventoryCache {
  @@unique([connectionId, sku], name: "connectionId_sku")
}
```

This enables efficient upsert operations for inventory tracking.

#### 3. Mock Prokip API Updates (`/backend/tests/mock-prokip-api.js`)
The mock server already included:
- `POST /connector/api/product` - Create products
- `POST /connector/api/sell` - Record sales
- `POST /connector/api/purchase` - Add inventory
- `GET /connector/api/product-stock-report` - Query inventory

### Frontend Changes

#### 1. New Page: Prokip Operations
- Added to sidebar navigation
- Contains three operation cards:
  - Create Product
  - Record Sale
  - Record Purchase
- Shows recent operations (placeholder for future enhancement)

#### 2. New Modals
- **Create Product Modal**: Form for creating new products
- **Record Sale Modal**: Dynamic form with multiple line items support
- **Record Purchase Modal**: Dynamic form with multiple line items support

Each modal displays real-time sync results showing:
- Success/failure for Prokip operation
- Success/failure for each connected store
- Detailed error messages if any

#### 3. JavaScript Functions
```javascript
- openCreateProductModal()
- createProduct()
- openRecordSaleModal()
- recordSale()
- addSaleItem() / removeSaleItem()
- openRecordPurchaseModal()
- recordPurchase()
- addPurchaseItem() / removePurchaseItem()
```

#### 4. CSS Styling
Added comprehensive styles for:
- Operation cards with hover effects
- Dynamic item rows with grid layout
- Result display with success/error states
- Responsive design for mobile devices

## Data Flow

### Create Product Flow
```
User fills form → Frontend validates → POST /prokip/products
  ↓
Backend validates → Creates in Prokip → Gets all connections
  ↓
For each connection:
  - Creates product in Shopify/WooCommerce
  - Updates InventoryCache
  ↓
Returns aggregated results → Frontend displays sync status
```

### Record Sale Flow
```
User adds items → Frontend validates → POST /prokip/sales
  ↓
Backend validates → Records sale in Prokip → Gets all connections
  ↓
For each connection:
  - Reduces inventory in Shopify/WooCommerce
  - Updates InventoryCache
  ↓
Returns aggregated results → Frontend displays sync status
```

### Record Purchase Flow
```
User adds items → Frontend validates → POST /prokip/purchases
  ↓
Backend validates → Records purchase in Prokip → Gets all connections
  ↓
For each connection:
  - Increases inventory in Shopify/WooCommerce
  - Updates InventoryCache
  ↓
Returns aggregated results → Frontend displays sync status
```

## Error Handling

### Validation
- Frontend validates all required fields before submission
- Backend validates data types, ranges, and business rules
- Duplicate SKU detection for product creation

### Sync Errors
- Each store sync operation is independent
- Failures in one store don't affect others
- Detailed error messages returned per store
- UI displays both successful and failed operations

### Inventory Tracking
- InventoryCache tracks current stock per store
- Prevents negative inventory (configurable)
- Detects and reports insufficient stock

## Testing

### Manual Testing Steps

1. **Start the servers**:
   ```bash
   # Terminal 1: Mock Prokip API
   cd backend/tests
   MOCK_PROKIP=true node mock-prokip-api.js

   # Terminal 2: Backend server
   cd backend
   npm start
   
   # Terminal 3: Frontend (if using http-server)
   cd frontend/public
   npx http-server -p 3000
   ```

2. **Test Create Product**:
   - Login to dashboard
   - Navigate to "Prokip Operations"
   - Click "Create Product"
   - Fill in all fields (SKU: TEST-001, Name: Test Product, etc.)
   - Submit and verify sync results

3. **Test Record Sale**:
   - Click "Record Sale"
   - Add SKU from previously created product
   - Set quantity and price
   - Submit and verify inventory decreased in connected stores

4. **Test Record Purchase**:
   - Click "Record Purchase"
   - Add same SKU
   - Set quantity and cost
   - Submit and verify inventory increased in connected stores

## Environment Configuration

The system respects existing mock configuration:
- `MOCK_PROKIP=true` - Uses mock Prokip server (port 4000)
- `MOCK_SHOPIFY=false` - Uses real Shopify API (except OAuth)
- `MOCK_WOO=false` - Uses real WooCommerce API

## Compatibility

✅ **Preserves Existing Functionality**:
- Shopify OAuth connection still works
- WooCommerce connection still works
- Webhook processing unchanged
- Order sync functionality intact
- Product sync functionality intact

✅ **Database Compatibility**:
- Migration adds constraint without breaking existing data
- Cleaned up duplicate records before applying constraint
- All existing models remain unchanged

## Future Enhancements

Potential improvements:
1. **Recent Operations List**: Display history of manual operations
2. **Batch Operations**: Upload CSV for bulk product creation
3. **Product Search**: Auto-complete SKU fields in sale/purchase modals
4. **Inventory Alerts**: Notify when stock levels are low
5. **Supplier Management**: Track and manage supplier relationships
6. **Sales Analytics**: Dashboard for manual sales reporting
7. **Return Processing**: Handle sales returns and refunds

## Files Modified

### Backend
- ✅ `/backend/src/app.js` - Added prokipRoutes registration
- ✅ `/backend/src/routes/prokipRoutes.js` - NEW FILE (3 endpoints)
- ✅ `/backend/prisma/schema.prisma` - Added unique constraint
- ✅ `/backend/prisma/migrations/20260106191233_add_inventory_cache_unique_constraint/` - NEW MIGRATION

### Frontend
- ✅ `/frontend/public/index.html` - Added Prokip Operations page and modals
- ✅ `/frontend/public/script.js` - Added operation functions
- ✅ `/frontend/public/styles.css` - Added operation styles

### Testing
- ✅ `/backend/tests/mock-prokip-api.js` - Already had required endpoints

## Notes

- The feature is fully functional with mock servers
- Can switch to production Prokip API by changing MOCK_PROKIP environment variable
- All operations require valid authentication token
- Business location must be selected before accessing operations
- SKU must match exactly between Prokip and connected stores for sync to work
