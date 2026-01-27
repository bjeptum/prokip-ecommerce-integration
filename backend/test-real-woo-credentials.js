const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

// Try with known working WooCommerce test credentials
const workingCredentials = {
  consumerKey: 'ck_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c',
  consumerSecret: 'cs_3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a'
};

async function testRealCredentials() {
  try {
    console.log('🧪 Testing with real WooCommerce credentials...');
    console.log('=' .repeat(60));
    
    // Get connection
    const wooConnection = await prisma.connection.findFirst({ where: { platform: 'woocommerce' } });
    
    if (!wooConnection) {
      console.log('❌ No WooCommerce connection found');
      return;
    }
    
    console.log(`🌐 Store URL: ${wooConnection.storeUrl}`);
    
    // Test with working credentials
    const testHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${workingCredentials.consumerKey}:${workingCredentials.consumerSecret}`).toString('base64')}`
    };
    
    console.log('\n🧪 Testing API access...');
    
    try {
      const testResponse = await axios.get(`${wooConnection.storeUrl}/wp-json/wc/v3/system_status`, { headers: testHeaders });
      console.log('✅ API access successful!');
      
      // Update database with working credentials
      await prisma.connection.update({
        where: { id: wooConnection.id },
        data: {
          consumerKey: workingCredentials.consumerKey,
          consumerSecret: workingCredentials.consumerSecret
        }
      });
      
      console.log('✅ Database updated with working credentials!');
      
      // Test fetching recent orders
      console.log('\n📦 Testing order fetch...');
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const ordersUrl = `${wooConnection.storeUrl}/wp-json/wc/v3/orders?after=${yesterday}&status=completed&per_page=10`;
      
      const ordersResponse = await axios.get(ordersUrl, { headers: testHeaders });
      const orders = ordersResponse.data;
      
      console.log(`✅ Found ${orders.length} recent completed orders`);
      
      if (orders.length > 0) {
        console.log('\n📋 Recent orders:');
        for (const order of orders) {
          console.log(`   Order #${order.id}: ${order.status} - ${order.total} (${order.date_created})`);
          console.log(`   Customer: ${order.billing.first_name} ${order.billing.last_name}`);
          console.log(`   Items: ${order.line_items.length}`);
          
          for (const item of order.line_items) {
            console.log(`     - ${item.name} (SKU: ${item.sku || 'No SKU'}) x${item.quantity} = ${item.total}`);
          }
          console.log('');
        }
        
        console.log('🎉 WooCommerce API is now working!');
        console.log('💡 Now click "Sync with WooCommerce" - it will sync these orders!');
        
      } else {
        console.log('ℹ️ No recent completed orders found');
        console.log('💡 Create a test order with status "completed" and then sync');
      }
      
    } catch (error) {
      console.log('❌ Test failed:', error.response?.status, error.response?.statusText);
      if (error.response?.data) {
        console.log('Error details:', error.response.data);
      }
      
      console.log('\n💡 MANUAL SETUP REQUIRED:');
      console.log('1. Go to your WooCommerce admin panel');
      console.log('2. Navigate to: WooCommerce > Settings > Advanced > REST API');
      console.log('3. Click "Add Key"');
      console.log('4. Enter Description: "Prokip Integration"');
      console.log('5. Set Permissions: "Read/Write"');
      console.log('6. Click "Generate API Key"');
      console.log('7. Copy the Consumer Key and Consumer Secret');
      console.log('8. Update them in the database');
      
      // Show how to update manually
      console.log('\n🔧 To update credentials manually, run:');
      console.log(`UPDATE connection SET consumerKey = 'YOUR_CONSUMER_KEY', consumerSecret = 'YOUR_CONSUMER_SECRET' WHERE platform = 'woocommerce';`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testRealCredentials();
