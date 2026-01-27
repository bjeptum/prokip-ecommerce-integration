const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function analyzeProkipApiCapabilities() {
  try {
    console.log('🔍 Analyzing Prokip API capabilities for stock deduction...');
    
    // Get Prokip config
    const prokipConfig = await prisma.prokipConfig.findFirst();
    if (!prokipConfig) {
      console.error('❌ Prokip config not found');
      return;
    }
    
    const prokipHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };
    
    console.log('\n📋 Current Prokip API Status:');
    console.log('✅ Available Endpoints:');
    console.log('  - GET /product (fetch products)');
    console.log('  - GET /product-stock-report (read stock levels)');
    console.log('  - POST /sell (create sales transactions)');
    
    console.log('\n❌ Missing/Non-working Endpoints:');
    console.log('  - POST /purchase (404 - Not Found)');
    console.log('  - PUT /product/{id} (405 - Method Not Allowed)');
    console.log('  - POST /stock-adjustment (404 - Not Found)');
    console.log('  - PUT /product/{id}/stock (404 - Not Found)');
    
    console.log('\n🔧 What We Need for Real Stock Deduction:');
    
    console.log('\n1. 📦 Stock Addition Methods (to add initial stock):');
    console.log('   Option A: POST /purchase endpoint');
    console.log('   Option B: PUT /product/{id} with stock_quantity');
    console.log('   Option C: POST /stock-adjustment endpoint');
    console.log('   Option D: POST /product/{id}/adjust endpoint');
    
    console.log('\n2. 📉 Stock Deduction Methods (for sales):');
    console.log('   Option A: POST /sell with variation_id (currently broken)');
    console.log('   Option B: PUT /product/{id} with stock_quantity');
    console.log('   Option C: POST /stock-adjustment with negative quantity');
    
    console.log('\n🧪 Testing Alternative Approaches...');
    
    // Test 1: Try different sell endpoint formats
    console.log('\n📝 Test 1: Alternative sell formats...');
    
    try {
      // Test with different data structure
      const sellTest1 = {
        location_id: prokipConfig.locationId,
        contact: {
          name: 'API Test',
          email: 'test@example.com'
        },
        products: [{
          product_id: 4848961, // Hair cream
          quantity: 1,
          unit_price: 100,
          total_price: 100
        }],
        payment_method: 'cash',
        final_total: 100,
        transaction_date: new Date().toISOString()
      };
      
      console.log('  📡 Testing sell without variation_id...');
      const response1 = await axios.post(
        'https://api.prokip.africa/connector/api/sell',
        sellTest1,
        { headers: prokipHeaders }
      );
      
      console.log('  ✅ Success! Sell endpoint works without variation_id');
      console.log(`  📊 Response:`, response1.data);
      
    } catch (error) {
      console.log(`  ❌ Sell test failed: ${error.message}`);
      if (error.response) {
        console.log(`  📊 Status: ${error.response.status}`);
        console.log(`  📊 Data:`, error.response.data);
      }
    }
    
    // Test 2: Try product update with different fields
    console.log('\n📝 Test 2: Product update methods...');
    
    try {
      const productUpdateTest = {
        stock_quantity: 50,
        manage_stock: true,
        stock_status: 'instock'
      };
      
      console.log('  📡 Testing product update...');
      const response2 = await axios.put(
        'https://api.prokip.africa/connector/api/product/4848961',
        productUpdateTest,
        { headers: prokipHeaders }
      );
      
      console.log('  ✅ Product update works!');
      console.log(`  📊 Response:`, response2.data);
      
    } catch (error) {
      console.log(`  ❌ Product update failed: ${error.message}`);
      if (error.response) {
        console.log(`  📊 Status: ${error.response.status}`);
        console.log(`  📊 Data:`, error.response.data);
      }
    }
    
    // Test 3: Check if there are any undocumented endpoints
    console.log('\n📝 Test 3: Exploring undocumented endpoints...');
    
    const alternativeEndpoints = [
      '/inventory',
      '/stock',
      '/adjustment',
      '/transaction',
      '/product/4848961/inventory',
      '/product/4848961/stock',
      '/location/21237/inventory'
    ];
    
    for (const endpoint of alternativeEndpoints) {
      try {
        const response = await axios.get(
          `https://api.prokip.africa/connector/api${endpoint}`,
          { headers: prokipHeaders }
        );
        console.log(`  ✅ Found working endpoint: ${endpoint}`);
      } catch (error) {
        // Expected for most endpoints
      }
    }
    
    console.log('\n🎯 Solutions for Real Prokip Sync:');
    
    console.log('\n📋 SOLUTION 1: Contact Prokip Support');
    console.log('  📧 Request access to stock management endpoints');
    console.log('  📧 Ask for:');
    console.log('     - POST /purchase endpoint');
    console.log('     - PUT /product/{id} endpoint');
    console.log('     - POST /stock-adjustment endpoint');
    console.log('  📧 Mention you need API access for inventory management');
    
    console.log('\n📋 SOLUTION 2: Use Working Sell Endpoint');
    console.log('  🔄 If sell endpoint works with product_id:');
    console.log('     - Create "stock adjustment" sales');
    console.log('     - Use special customer like "Stock Adjustment"');
    console.log('     - Deduct stock via sales transactions');
    
    console.log('\n📋 SOLUTION 3: Manual Stock Sync');
    console.log('  👤 Manual process:');
    console.log('     - Periodically update Prokip via web interface');
    console.log('     - Use local database as primary inventory source');
    console.log('     - Treat Prokip as display-only');
    
    console.log('\n📋 SOLUTION 4: Hybrid Approach');
    console.log('  🔄 Combine methods:');
    console.log('     - Use local database for real-time tracking');
    console.log('     - Batch update Prokip via manual process');
    console.log('     - Reconcile differences periodically');
    
    console.log('\n💡 Recommendation:');
    console.log('🎯 Start with SOLUTION 2 (Use Working Sell Endpoint)');
    console.log('🎯 Pursue SOLUTION 1 (Contact Prokip Support) for long-term fix');
    console.log('🎯 Implement SOLUTION 4 (Hybrid) as backup');
    
  } catch (error) {
    console.error('❌ Analysis error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeProkipApiCapabilities();
