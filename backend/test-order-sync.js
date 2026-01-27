const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testOrderSync() {
  try {
    console.log('🔄 Testing order sync functionality...');
    
    // Get Prokip config for authentication
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });
    
    if (!prokipConfig?.token) {
      console.log('No Prokip config found');
      return;
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`
    };
    
    // Test 1: Pull orders (global sync)
    console.log('\n📋 Step 1: Testing /sync/pull-orders...');
    const pullOrdersResponse = await axios.post('http://localhost:3000/sync/pull-orders', {}, {
      headers
    });
    
    console.log(`Pull orders result: ${pullOrdersResponse.data.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Message: ${pullOrdersResponse.data.message}`);
    
    // Test 2: Pull sales (specific store sync)
    console.log('\n📋 Step 2: Testing /sync/pull-sales for Store 5...');
    const pullSalesResponse = await axios.post('http://localhost:3000/sync/pull-sales', {
      connectionId: 5
    }, {
      headers
    });
    
    console.log(`Pull sales result: ${pullSalesResponse.data.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Message: ${pullSalesResponse.data.message}`);
    console.log(`Orders processed: ${pullSalesResponse.data.ordersProcessed || 0}`);
    
    // Test 3: Check if orders appear in frontend endpoint
    console.log('\n📋 Step 3: Checking if orders appear in frontend...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    const ordersResponse = await axios.get('http://localhost:3000/stores/my-store/orders?connectionId=5', {
      headers
    });
    
    const orders = ordersResponse.data.orders || [];
    console.log(`Orders found: ${orders.length}`);
    
    if (orders.length > 0) {
      console.log('\n🎉 SUCCESS! Orders are now appearing:');
      orders.slice(0, 3).forEach((order, index) => {
        console.log(`${index + 1}. Order #${order.orderId || order.id} - ${order.total || order.total_price} - ${order.status || order.financial_status}`);
      });
    } else {
      console.log('\n❌ Still no orders found. Checking backend logs for errors...');
    }
    
    // Test 4: Direct WooCommerce order fetch test
    console.log('\n🔍 Step 4: Testing direct WooCommerce order fetch...');
    const { getWooOrders } = require('./src/services/wooService');
    const { decryptCredentials } = require('./src/services/storeService');
    
    const connection = await prisma.connection.findFirst({
      where: { id: 5 }
    });
    
    if (connection) {
      const { consumerKey, consumerSecret } = decryptCredentials(connection);
      const wooOrders = await getWooOrders(connection.storeUrl, consumerKey, consumerSecret);
      
      console.log(`Direct WooCommerce fetch: ${wooOrders.length} orders`);
      
      if (wooOrders.length > 0) {
        console.log('✅ Direct WooCommerce fetch works - issue is in sync logic');
        wooOrders.slice(0, 3).forEach((order, index) => {
          console.log(`${index + 1}. Order #${order.id} - ${order.total} - ${order.status}`);
        });
      } else {
        console.log('❌ Direct WooCommerce fetch also returns 0 orders');
        console.log('This means either:');
        console.log('  - No orders exist in WooCommerce');
        console.log('  - Authentication is failing');
        console.log('  - WooCommerce API endpoint issue');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testOrderSync();
