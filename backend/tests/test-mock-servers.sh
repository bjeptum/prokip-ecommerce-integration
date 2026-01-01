#!/bin/bash

# Quick Test Script for Mock Servers
# This shows you how to correctly test each mock API

echo "======================================"
echo "Testing Mock Server Endpoints"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test Mock Prokip API (Port 4000)
echo "1. Testing Mock Prokip API (Port 4000)"
echo "--------------------------------------"
echo "Endpoint: GET /connector/api/product"
echo ""

PROKIP_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  http://localhost:4000/connector/api/product \
  -H "Authorization: Bearer mock_prokip_api_key_12345" \
  -H "Accept: application/json")

HTTP_STATUS=$(echo "$PROKIP_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
BODY=$(echo "$PROKIP_RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo -e "${GREEN}✅ Prokip API: SUCCESS (Status: $HTTP_STATUS)${NC}"
  echo "Sample response:"
  echo "$BODY" | head -c 200
  echo "..."
else
  echo -e "${RED}❌ Prokip API: FAILED (Status: $HTTP_STATUS)${NC}"
  echo "Response: $BODY"
fi

echo ""
echo ""

# Test Mock Shopify API (Port 4001)
echo "2. Testing Mock Shopify API (Port 4001)"
echo "--------------------------------------"
echo "Endpoint: GET /admin/api/2026-01/products.json"
echo ""

SHOPIFY_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  http://localhost:4001/admin/api/2026-01/products.json \
  -H "X-Shopify-Access-Token: mock_shopify_access_token" \
  -H "Accept: application/json")

HTTP_STATUS=$(echo "$SHOPIFY_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
BODY=$(echo "$SHOPIFY_RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo -e "${GREEN}✅ Shopify API: SUCCESS (Status: $HTTP_STATUS)${NC}"
  echo "Sample response:"
  echo "$BODY" | head -c 200
  echo "..."
else
  echo -e "${RED}❌ Shopify API: FAILED (Status: $HTTP_STATUS)${NC}"
  echo "Response: $BODY"
fi

echo ""
echo ""

# Test Mock WooCommerce API (Port 4002)
echo "3. Testing Mock WooCommerce API (Port 4002)"
echo "--------------------------------------"
echo "Endpoint: GET /wp-json/wc/v3/products"
echo ""

WOO_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  http://localhost:4002/wp-json/wc/v3/products \
  -u "ck_mock_key:cs_mock_secret" \
  -H "Accept: application/json")

HTTP_STATUS=$(echo "$WOO_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
BODY=$(echo "$WOO_RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo -e "${GREEN}✅ WooCommerce API: SUCCESS (Status: $HTTP_STATUS)${NC}"
  echo "Sample response:"
  echo "$BODY" | head -c 200
  echo "..."
else
  echo -e "${RED}❌ WooCommerce API: FAILED (Status: $HTTP_STATUS)${NC}"
  echo "Response: $BODY"
fi

echo ""
echo ""

# Test Backend API (Port 3000)
echo "4. Testing Backend API (Port 3000)"
echo "--------------------------------------"
echo "Endpoint: POST /api/auth/login"
echo ""

LOGIN_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"securepassword123"}')

HTTP_STATUS=$(echo "$LOGIN_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
BODY=$(echo "$LOGIN_RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo -e "${GREEN}✅ Backend Login: SUCCESS (Status: $HTTP_STATUS)${NC}"
  echo "Response: $BODY"
else
  echo -e "${RED}❌ Backend Login: FAILED (Status: $HTTP_STATUS)${NC}"
  echo "Response: $BODY"
fi

echo ""
echo ""
echo "======================================"
echo "Test Summary"
echo "======================================"
echo ""
echo "Mock servers should be running on:"
echo "  • Prokip:      http://localhost:4000"
echo "  • Shopify:     http://localhost:4001"
echo "  • WooCommerce: http://localhost:4002"
echo "  • Backend:     http://localhost:3000"
echo ""
echo "Common Issues:"
echo "  • 'Connection refused' = Server not running"
echo "  • 'Unauthenticated' = Missing Authorization header"
echo "  • 'Cannot GET /' = Wrong endpoint (use correct API path)"
echo "  • 'Unauthorized' = Wrong credentials"
echo ""
echo "Correct Test Commands:"
echo ""
echo "Prokip (needs Bearer token):"
echo "  curl http://localhost:4000/connector/api/product \\"
echo "    -H 'Authorization: Bearer mock_prokip_api_key_12345'"
echo ""
echo "Shopify (needs X-Shopify-Access-Token):"
echo "  curl http://localhost:4001/admin/api/2026-01/products.json \\"
echo "    -H 'X-Shopify-Access-Token: mock_shopify_access_token'"
echo ""
echo "WooCommerce (needs Basic Auth):"
echo "  curl http://localhost:4002/wp-json/wc/v3/products \\"
echo "    -u 'ck_mock_key:cs_mock_secret'"
echo ""
