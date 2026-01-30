const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');

const prisma = new PrismaClient();

async function testAlternativeStockEndpoints() {
  console.log('🔍 Testing Alternative Stock Endpoints');
  console.log('=====================================');

  try {
    // 1. Test different possible endpoints
    const endpoints = [
      '/connector/api/stock-adjustments',
      '/connector/api/stock_adjustments',
      '/connector/api/stockadjustments',
      '/connector/api/adjustments',
      '/connector/api/inventory/adjust',
      '/connector/api/products/adjust-stock',
      '/connector/api/stock/deduct'
    ];

    const headers = await prokipService.getAuthHeaders(50);
    const testPayload = {
      location_id: 21237,
      adjustment_date: '2026-01-28 03:52:20',
      reason: 'Test adjustment',
      final_total: 0,
      products: [{
        product_id: 4848961,
        quantity: 1,
        unit_price: 0,
        adjustment_type: 'subtract'
      }]
    };

    console.log('\n1️⃣ Testing different endpoints...');
    
    for (const endpoint of endpoints) {
      try {
        const axios = require('axios');
        const response = await axios.post(
          `https://api.prokip.africa${endpoint}`,
          testPayload,
          { headers, timeout: 5000 }
        );
        console.log(`✅ ${endpoint} - SUCCESS (Status: ${response.status})`);
        console.log(`   Response:`, response.data);
        break; // Stop at first successful endpoint
      } catch (error) {
        if (error.response?.status === 404) {
          console.log(`❌ ${endpoint} - Not Found (404)`);
        } else if (error.response?.status === 405) {
          console.log(`⚠️  ${endpoint} - Method Not Allowed (405)`);
        } else if (error.response?.status === 422) {
          console.log(`⚠️  ${endpoint} - Validation Error (422)`);
          console.log(`   Error:`, error.response.data);
        } else {
          console.log(`❌ ${endpoint} - Error: ${error.response?.status || error.message}`);
        }
      }
    }

    // 2. Try using the sell endpoint with negative quantities
    console.log('\n2️⃣ Testing sell endpoint with stock reduction...');
    
    const sellPayload = {
      sells: [{
        invoice_no: 'STOCK-ADJUST-' + Date.now(),
        customer_id: null,
        sell_date: '2026-01-28',
        payment_status: 'paid',
        products: [{
          product_id: 4848961,
          quantity: -1, // Negative quantity for stock reduction
          unit_price: 0
        }]
      }]
    };

    try {
      const axios = require('axios');
      const response = await axios.post(
        'https://api.prokip.africa/connector/api/sell',
        sellPayload,
        { headers, timeout: 10000 }
      );
      console.log('✅ Sell endpoint with negative quantity - SUCCESS');
      console.log(`   Response:`, response.data);
    } catch (error) {
      console.log('❌ Sell endpoint with negative quantity - FAILED');
      console.log(`   Error:`, error.response?.data || error.message);
    }

    // 3. Check if there's a dedicated stock update endpoint
    console.log('\n3️⃣ Testing product stock update endpoint...');
    
    try {
      const axios = require('axios');
      const response = await axios.put(
        'https://api.prokip.africa/connector/api/product/4848961',
        {
          stock: 69, // Reduce by 1
          location_id: 21237
        },
        { headers, timeout: 10000 }
      );
      console.log('✅ Product stock update - SUCCESS');
      console.log(`   Response:`, response.data);
    } catch (error) {
      console.log('❌ Product stock update - FAILED');
      console.log(`   Error:`, error.response?.data || error.message);
    }

    console.log('\n✅ Endpoint testing completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run test
testAlternativeStockEndpoints();
