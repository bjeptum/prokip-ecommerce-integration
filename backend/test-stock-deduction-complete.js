#!/usr/bin/env node

/**
 * COMPREHENSIVE STOCK DEDUCTION TEST
 * 
 * Tests the complete stock deduction workflow from WooCommerce to Prokip
 */

const axios = require('axios');

const BACKEND_URL = 'http://localhost:3000';

console.log('🧪 TESTING STOCK DEDUCTION FIX');
console.log('==============================');

async function testStockDeduction() {
  try {
    // Test 1: Check server health
    console.log('1. 🏥 Checking server health...');
    const healthResponse = await axios.get(`${BACKEND_URL}/health`);
    if (healthResponse.status === 200) {
      console.log('   ✅ Server is running');
    } else {
      throw new Error('Server not healthy');
    }

    // Test 2: Check if we have connections
    console.log('\n2. 🔗 Checking store connections...');
    try {
      const statusResponse = await axios.get(`${BACKEND_URL}/sync/status`);
      const connections = statusResponse.data.stores || [];
      
      if (connections.length === 0) {
        console.log('   ⚠️  No store connections found');
        console.log('   💡 Please connect a WooCommerce store first');
        return;
      }
      
      console.log(`   ✅ Found ${connections.length} store connection(s)`);
      connections.forEach((conn, index) => {
        console.log(`      ${index + 1}. ${conn.platform} - ${conn.storeUrl}`);
        console.log(`         Products: ${conn.productCount || 0}, Orders: ${conn.orderCount || 0}`);
      });
      
      const connection = connections[0];
      console.log(`   🎯 Using connection: ${connection.platform} (ID: ${connection.id})`);
      
      // Test 3: Test the pull-sales endpoint with stock deduction
      console.log('\n3. 🔄 Testing sales sync with stock deduction...');
      
      try {
        const syncResponse = await axios.post(`${BACKEND_URL}/sync/pull-sales`, {
          connectionId: connection.id
        }, {
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60 second timeout for processing
        });
        
        if (syncResponse.status === 200) {
          console.log('   ✅ Sales sync endpoint working');
          console.log(`   📊 Orders processed: ${syncResponse.data.ordersProcessed || 0}`);
          console.log(`   🕐 Sync completed at: ${syncResponse.data.syncedAt}`);
          
          if (syncResponse.data.ordersProcessed > 0) {
            console.log('   🎉 ORDERS FOUND AND PROCESSED!');
            console.log('   🔍 Check server console for detailed stock deduction logs');
          } else {
            console.log('   ⚠️  No orders to process (this might be normal)');
            console.log('   💡 Make sure you have completed orders in WooCommerce');
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

      // Test 4: Check sales logs for stock deduction status
      console.log('\n4. 📋 Checking sales logs for stock deduction...');
      try {
        const salesResponse = await axios.get(`${BACKEND_URL}/api/sales`, {
          validateStatus: () => true
        });
        
        if (salesResponse.status === 200 && salesResponse.data.success) {
          const sales = salesResponse.data.sales || [];
          console.log(`   📊 Found ${sales.length} sales records`);
          
          const recentSales = sales.slice(0, 5); // Show last 5
          let stockDeductedCount = 0;
          
          recentSales.forEach(sale => {
            console.log(`      🧾 Order ${sale.orderId}:`);
            console.log(`         Stock Deducted: ${sale.stockDeducted ? '✅ Yes' : '❌ No'}`);
            console.log(`         Deduction Date: ${sale.stockDeductionDate || 'Not set'}`);
            console.log(`         Platform: ${sale.platform || 'Unknown'}`);
            console.log(`         Total: ${sale.totalAmount}`);
            
            if (sale.stockDeducted) {
              stockDeductedCount++;
            }
          });
          
          console.log(`   📈 Stock Deduction Rate: ${stockDeductedCount}/${recentSales.length} recent orders`);
          
        } else {
          console.log('   ⚠️  Could not access sales logs');
        }
      } catch (error) {
        console.log('   ⚠️  Sales log check failed');
      }

    } catch (error) {
      console.log('   ❌ Failed to get connection status');
      console.log(`   🚫 Error: ${error.message}`);
    }

    console.log('\n🎯 STOCK DEDUCTION WORKFLOW');
    console.log('========================');
    console.log('');
    console.log('📋 EXPECTED WORKFLOW:');
    console.log('1. 🛒 Make a sale in WooCommerce');
    console.log('2. 🔄 Click "Sync Sales" in dashboard');
    console.log('3. 📦 System fetches orders from WooCommerce');
    console.log('4. 💰 Creates sales in Prokip');
    console.log('5. ⭐ AUTOMATICALLY DEDUCTS STOCK in Prokip');
    console.log('6. 📊 Updates sales log with stock deduction status');
    console.log('');
    console.log('🔍 EXPECTED CONSOLE OUTPUT:');
    console.log('   🔄 Processing order #XXXX for stock deduction...');
    console.log('   🔄 Deducting stock for order #XXXX...');
    console.log('   📦 Products to deduct: [{sku: "ABC-123", quantity: 2}]');
    console.log('   📝 Stock adjustment for ABC-123...');
    console.log('   ✅ Stock deducted for ABC-123: 2 units');
    console.log('   🎉 STOCK DEDUCTION SUCCESSFUL for order #XXXX!');
    console.log('');
    console.log('🧪 MANUAL TESTING STEPS:');
    console.log('1. 🌐 Open dashboard: http://localhost:3000');
    console.log('2. 🔐 Login to Prokip with your credentials');
    console.log('3. 🛒 Make a test sale in WooCommerce (with products that have SKUs)');
    console.log('4. 🔄 Click "Sync Sales" button in dashboard');
    console.log('5. 👀 Watch server console for stock deduction logs');
    console.log('6. 📊 Check Prokip stock levels before and after');
    console.log('7. 📋 Check sales logs for stockDeducted: true');
    console.log('');
    console.log('🚨 TROUBLESHOOTING:');
    console.log('• If no orders found: Make sure WooCommerce orders are "completed"');
    console.log('• If stock not deducted: Check product SKUs match in both systems');
    console.log('• If errors occur: Check Prokip authentication and API permissions');
    console.log('• Check console for detailed error messages');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testStockDeduction().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});
