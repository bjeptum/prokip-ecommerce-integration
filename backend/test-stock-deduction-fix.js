#!/usr/bin/env node

/**
 * TEST STOCK DEDUCTION FIX
 * 
 * This script tests the fixed sales sync with stock deduction
 */

const axios = require('axios');

const BACKEND_URL = 'http://localhost:3000';

console.log('🧪 TESTING STOCK DEDUCTION FIX');
console.log('================================');

async function testStockDeduction() {
  try {
    // Test 1: Check if server is running
    console.log('1. 🏥 Checking server health...');
    const healthResponse = await axios.get(`${BACKEND_URL}/health`);
    if (healthResponse.status === 200) {
      console.log('   ✅ Server is running');
    } else {
      throw new Error('Server not healthy');
    }

    // Test 2: Test the pull-sales endpoint with stock deduction
    console.log('\n2. 🔄 Testing sales sync with stock deduction...');
    
    // First, let's check if we have any connections
    const connectionsResponse = await axios.get(`${BACKEND_URL}/sync/status`);
    const connections = connectionsResponse.data.connections || [];
    
    if (connections.length === 0) {
      console.log('   ⚠️  No store connections found');
      console.log('   💡 Please connect a WooCommerce store first');
      return;
    }
    
    const connection = connections[0];
    console.log(`   📦 Found connection: ${connection.platform} - ${connection.storeUrl}`);
    
    // Test the pull-sales endpoint
    console.log('   🔄 Testing pull-sales endpoint...');
    
    try {
      const syncResponse = await axios.post(`${BACKEND_URL}/sync/pull-sales`, {
        connectionId: connection.id
      }, {
        headers: {
          'Authorization': 'Bearer test-token', // This will use the fallback auth
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });
      
      if (syncResponse.status === 200) {
        console.log('   ✅ Sales sync endpoint working');
        console.log(`   📊 Response: ${JSON.stringify(syncResponse.data, null, 2)}`);
        
        // Check if orders were processed
        if (syncResponse.data.ordersProcessed > 0) {
          console.log(`   🎉 Processed ${syncResponse.data.ordersProcessed} orders`);
          console.log('   🔍 Check server console for stock deduction logs');
        } else {
          console.log('   ⚠️  No orders to process (this might be normal)');
        }
      } else {
        console.log(`   ⚠️  Unexpected response: ${syncResponse.status}`);
      }
    } catch (error) {
      console.log('   ❌ Sales sync test failed');
      console.log(`   🚫 Error: ${error.message}`);
      
      if (error.response) {
        console.log(`   📊 Response: ${JSON.stringify(error.response.data, null, 2)}`);
      }
    }

    // Test 3: Check sales logs for stock deduction status
    console.log('\n3. 📋 Checking sales logs...');
    try {
      const salesResponse = await axios.get(`${BACKEND_URL}/api/sales`, {
        validateStatus: () => true
      });
      
      if (salesResponse.status === 200 && salesResponse.data.success) {
        const sales = salesResponse.data.sales || [];
        console.log(`   📊 Found ${sales.length} sales records`);
        
        const recentSales = sales.slice(0, 5); // Show last 5
        recentSales.forEach(sale => {
          console.log(`      🧾 Order ${sale.orderId}:`);
          console.log(`         Stock Deducted: ${sale.stockDeducted ? '✅ Yes' : '❌ No'}`);
          console.log(`         Deduction Date: ${sale.stockDeductionDate || 'Not set'}`);
          console.log(`         Platform: ${sale.platform}`);
          console.log(`         Total: ${sale.totalAmount}`);
        });
      } else {
        console.log('   ⚠️  Could not access sales logs');
      }
    } catch (error) {
      console.log('   ⚠️  Sales log check failed');
    }

    console.log('\n🎯 TESTING COMPLETE!');
    console.log('\n📋 What to check:');
    console.log('1. 🖥️  Server console should show stock deduction logs');
    console.log('2. 📊 Sales logs should show stockDeducted: true');
    console.log('3. 🏪 Prokip stock levels should decrease after sync');
    console.log('\n🔍 Expected console output:');
    console.log('   🔄 Deducting stock for order #XXXX...');
    console.log('   ✅ Stock deducted successfully for order #XXXX');
    console.log('   🎉 STOCK DEDUCTION SUCCESSFUL for order #XXXX!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testStockDeduction().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});
