# Prokip API Testing Guide

## Prerequisites
1. Get your Prokip API credentials:
   - API Token
   - Location ID
   - Base URL: `https://api.prokip.africa`

## Step 1: Test Authentication

```bash
# Set your credentials
export PROKIP_TOKEN="your_actual_prokip_token_here"
export PROKIP_LOCATION="your_location_id"
export PROKIP_API="https://api.prokip.africa"

# Test authentication
curl -X GET "${PROKIP_API}/connector/api/product?per_page=1" \
  -H "Authorization: Bearer ${PROKIP_TOKEN}" \
  -H "Accept: application/json" \
  -v
```

**Expected Response Format** (Document this):
```json
{
  "data": [...],
  "meta": {...}
}
```

---

## Step 2: Test Product Endpoints

### 2.1 Get All Products
```bash
curl -X GET "${PROKIP_API}/connector/api/product?per_page=-1" \
  -H "Authorization: Bearer ${PROKIP_TOKEN}" \
  -H "Accept: application/json" \
  > prokip-products-response.json

# View the response
cat prokip-products-response.json | jq '.'
```

### 2.2 Get Single Product
```bash
curl -X GET "${PROKIP_API}/connector/api/product/{product_id}" \
  -H "Authorization: Bearer ${PROKIP_TOKEN}" \
  -H "Accept: application/json" \
  > prokip-single-product.json
```

### 2.3 Document Product Schema
After getting responses, document the exact structure:
```json
{
  "data": [
    {
      "id": "...",
      "name": "...",
      "sku": "...",
      "product_variations": [
        {
          "variations": [
            {
              "sell_price_inc_tax": 0,
              "stock_quantity": 0
            }
          ]
        }
      ]
    }
  ]
}
```

---

## Step 3: Test Inventory Endpoints

### 3.1 Get Inventory for Location
```bash
curl -X GET "${PROKIP_API}/connector/api/inventory?location_id=${PROKIP_LOCATION}" \
  -H "Authorization: Bearer ${PROKIP_TOKEN}" \
  -H "Accept: application/json" \
  > prokip-inventory-response.json
```

### 3.2 Document Inventory Schema
```json
{
  "data": [
    {
      "sku": "...",
      "quantity": 0,
      "location_id": "..."
    }
  ]
}
```

---

## Step 4: Test Sales/Order Creation Endpoint

### 4.1 Create Sale (This is critical!)
```bash
curl -X POST "${PROKIP_API}/connector/api/sells" \
  -H "Authorization: Bearer ${PROKIP_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "location_id": "'"${PROKIP_LOCATION}"'",
    "contact_id": "walk-in-customer",
    "transaction_date": "2025-12-28",
    "items": [
      {
        "product_id": "test_product_id",
        "variation_id": "test_variation_id",
        "quantity": 1,
        "unit_price": 100
      }
    ]
  }' \
  > prokip-create-sale-response.json
```

### 4.2 Document Sale Response Schema
```json
{
  "success": true,
  "data": {
    "sell_id": "...",
    "transaction_id": "..."
  }
}
```

---

## Step 5: Test Refund/Return Endpoint

```bash
curl -X POST "${PROKIP_API}/connector/api/sells/{sell_id}/refund" \
  -H "Authorization: Bearer ${PROKIP_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "product_id": "...",
        "quantity": 1
      }
    ]
  }' \
  > prokip-refund-response.json
```

---

## Step 6: Document All Findings

Create a file with:
1. **Actual endpoint URLs**
2. **Request headers required**
3. **Request body schemas**
4. **Response body schemas**
5. **Error response formats**
6. **Status codes returned**

Example template:
```markdown
### Endpoint: Get Products
- **URL**: `GET /connector/api/product`
- **Headers**: 
  - `Authorization: Bearer {token}`
  - `Accept: application/json`
- **Query Params**: 
  - `per_page`: -1 (all products)
  - `location_id`: optional
- **Response 200**:
  ```json
  {actual response here}
  ```
- **Response 401**:
  ```json
  {error response here}
  ```
```

---

## Output Files to Create:
1. `prokip-products-response.json` - Product list response
2. `prokip-single-product.json` - Single product details
3. `prokip-inventory-response.json` - Inventory data
4. `prokip-create-sale-response.json` - Sale creation response
5. `prokip-refund-response.json` - Refund response
6. `prokip-api-documentation.md` - Complete API documentation
