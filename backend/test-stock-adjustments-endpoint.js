const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');
const axios = require('axios');

const prisma = new PrismaClient();

async function testStockAdjustmentsEndpoint() {
  console.log('🧪 Testing Prokip Stock Adjustments Endpoint');
  console.log('==========================================');

  try {
    const headers = await prokipService.getAuthHeaders(50);
    
    // 1. Test GET stock-adjustments first
    console.log('\n1️⃣ Testing GET /connector/api/stock-adjustments...');
    
    try {
      const getResponse = await axios.get(
        'https://api.prokip.africa/connector/api/stock-adjustments',
        { headers, timeout: 10000 }
      );
      
      console.log('✅ GET stock-adjustments SUCCESS!');
      console.log('   Response:', JSON.stringify(getResponse.data, null, 2));
      
    } catch (error) {
      console.log(`❌ GET stock-adjustments failed:`, error.response?.data || error.message);
    }

    // 2. Test POST stock-adjustments with different payloads
    console.log('\n2️⃣ Testing POST /connector/api/stock-adjustments...');
    
    const payloads = [
      // Format 1: Basic stock adjustment
      {
        location_id: 21237,
        adjustment_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        reason: 'WooCommerce sale stock reduction',
        final_total: 0,
        products: [{
          product_id: 4848961,
          variation_id: 5216467,
          quantity: -1, // Negative to reduce stock
          unit_price: 0,
          unit_price_inc_tax: 0
        }]
      },
      
      // Format 2: Simplified format
      {
        location_id: 21237,
        product_id: 4848961,
        quantity: -1,
        adjustment_type: 'sale',
        reason: 'WooCommerce order'
      },
      
      // Format 3: Transaction format
      {
        type: 'stock_adjustment',
        location_id: 21237,
        transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        notes: 'Stock reduction from WooCommerce sale',
        products: [{
          product_id: 4848961,
          quantity: -1,
          unit_price: 0
        }]
      },
      
      // Format 4: Opening stock format (for reference)
      {
        location_id: 21237,
        opening_stock_date: new Date().toISOString().slice(0, 10),
        products: [{
          product_id: 4848961,
          quantity: 69 // Set to desired quantity
        }]
      }
    ];

    for (let i = 0; i < payloads.length; i++) {
      try {
        console.log(`\n📝 Testing Payload Format ${i + 1}:`);
        console.log('   Payload:', JSON.stringify(payloads[i], null, 2));
        
        const postResponse = await axios.post(
          'https://api.prokip.africa/connector/api/stock-adjustments',
          payloads[i],
          { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 15000 }
        );
        
        console.log(`🎉 POST Format ${i + 1} SUCCESS!`);
        console.log('   Response:', JSON.stringify(postResponse.data, null, 2));
        
        // Check if stock actually changed
        await new Promise(resolve => setTimeout(resolve, 3000));
        const stockAfter = await prokipService.getInventory(null, 50);
        const stockItem = stockAfter.find(item => item.sku === '4848961');
        console.log(`   Stock after adjustment: ${stockItem ? stockItem.stock : 'Not found'}`);
        
        if (postResponse.status === 200 || postResponse.status === 201) {
          console.log('✅ WORKING FORMAT FOUND!');
          break; // Stop at first successful format
        }
        
      } catch (error) {
        console.log(`❌ POST Format ${i + 1} failed:`, error.response?.data?.message || error.message);
      }
    }

    // 3. Test opening-stock endpoint
    console.log('\n3️⃣ Testing /connector/api/opening-stock endpoint...');
    
    try {
      const openingStockPayload = {
        location_id: 21237,
        opening_stock_date: new Date().toISOString().slice(0, 10),
        products: [{
          product_id: 4848961,
          quantity: 69 // Set to current stock
        }]
      };

      const openingResponse = await axios.post(
        'https://api.prokip.africa/connector/api/opening-stock',
        openingStockPayload,
        { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 15000 }
      );
      
      console.log('🎉 Opening stock endpoint SUCCESS!');
      console.log('   Response:', JSON.stringify(openingResponse.data, null, 2));
      
    } catch (error) {
      console.log(`❌ Opening stock failed:`, error.response?.data?.message || error.message);
    }

    console.log('\n✅ Stock adjustments endpoint testing completed!');

  } catch (error) {
    console.error('❌ Testing failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testStockAdjustmentsEndpoint();
