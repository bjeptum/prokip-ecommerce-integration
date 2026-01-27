const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testBothWooConnections() {
  try {
    console.log('🔍 TESTING: Both WooCommerce connections');
    console.log('=' .repeat(60));
    
    // Get all WooCommerce connections
    const wooConnections = await prisma.connection.findMany({ 
      where: { platform: 'woocommerce' } 
    });
    
    console.log(`Found ${wooConnections.length} WooCommerce connections`);
    
    for (let i = 0; i < wooConnections.length; i++) {
      const conn = wooConnections[i];
      console.log(`\n🔗 TESTING CONNECTION ${i + 1}:`);
      console.log('-'.repeat(40));
      console.log(`ID: ${conn.id}`);
      console.log(`Store URL: ${conn.storeUrl}`);
      console.log(`Consumer Key: ${conn.consumerKey ? 'Present' : 'Missing'}`);
      console.log(`Consumer Secret: ${conn.consumerSecret ? 'Present' : 'Missing'}`);
      
      // Test API access
      console.log('\n🧪 TESTING API ACCESS:');
      
      try {
        const testHeaders = {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${conn.consumerKey}:${conn.consumerSecret}`).toString('base64')}`
        };
        
        const testResponse = await axios.get(`${conn.storeUrl}/wp-json/wc/v3/system_status`, { headers: testHeaders });
        console.log('✅ API access: SUCCESS');
        
        // Test fetching orders
        console.log('\n📦 TESTING ORDERS FETCH:');
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const ordersUrl = `${conn.storeUrl}/wp-json/wc/v3/orders?after=${yesterday}&status=completed&per_page=10`;
        
        const ordersResponse = await axios.get(ordersUrl, { headers: testHeaders });
        const orders = ordersResponse.data;
        
        console.log(`✅ Found ${orders.length} recent completed orders`);
        
        if (orders.length > 0) {
          console.log('\n📋 RECENT ORDERS:');
          for (const order of orders.slice(0, 2)) {
            console.log(`   Order #${order.id}: ${order.status} - ${order.total} (${order.date_created})`);
            console.log(`   Customer: ${order.billing.first_name} ${order.billing.last_name}`);
            console.log(`   Items: ${order.line_items.length}`);
            
            for (const item of order.line_items) {
              console.log(`     - ${item.name} (SKU: ${item.sku || 'No SKU'}) x${item.quantity} = ${item.total}`);
            }
            console.log('');
          }
        }
        
        // Test updating product stock (Prokip → WooCommerce)
        console.log('\n🛒 TESTING STOCK UPDATE:');
        
        // Get products to test with
        const productsUrl = `${conn.storeUrl}/wp-json/wc/v3/products?per_page=5`;
        const productsResponse = await axios.get(productsUrl, { headers: testHeaders });
        const products = productsResponse.data;
        
        console.log(`✅ Found ${products.length} products`);
        
        if (products.length > 0) {
          const testProduct = products[0];
          console.log(`\n📦 Testing stock update for: ${testProduct.name}`);
          console.log(`   Current stock: ${testProduct.stock_quantity || 0}`);
          
          // Test stock update
          const updateData = {
            stock_quantity: (testProduct.stock_quantity || 0) + 1
          };
          
          const updateResponse = await axios.put(
            `${conn.storeUrl}/wp-json/wc/v3/products/${testProduct.id}`,
            updateData,
            { headers: testHeaders }
          );
          
          console.log(`✅ Stock updated to: ${updateResponse.data.stock_quantity}`);
          
          // Revert the change
          await axios.put(
            `${conn.storeUrl}/wp-json/wc/v3/products/${testProduct.id}`,
            { stock_quantity: testProduct.stock_quantity || 0 },
            { headers: testHeaders }
          );
          
          console.log('✅ Stock reverted to original value');
        }
        
        console.log('\n🎉 CONNECTION FULLY WORKING!');
        
      } catch (error) {
        console.log('❌ API access failed:', error.response?.status, error.response?.statusText);
        if (error.response?.data) {
          console.log('Error details:', error.response.data);
        }
      }
    }
    
    // Check which connection the sync is using
    console.log('\n🔄 CHECKING WHICH CONNECTION SYNC USES:');
    console.log('-'.repeat(40));
    
    // The sync logic uses the first WooCommerce connection found
    const primaryConnection = await prisma.connection.findFirst({ 
      where: { platform: 'woocommerce' } 
    });
    
    console.log(`Primary connection ID: ${primaryConnection.id}`);
    console.log(`Primary store URL: ${primaryConnection.storeUrl}`);
    
    // Test sync with this connection
    console.log('\n🧪 TESTING SYNC WITH PRIMARY CONNECTION:');
    
    try {
      const syncResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('✅ Sync response:', syncResponse.status);
      console.log('📊 Results:', JSON.stringify(syncResponse.data, null, 2));
      
    } catch (error) {
      console.log('❌ Sync failed:', error.message);
      if (error.response) {
        console.log('Response status:', error.response.status);
        console.log('Response data:', error.response.data);
      }
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('-'.repeat(40));
    console.log('1. If connection 4 works but connection 5 doesn\'t, update sync to use connection 4');
    console.log('2. If both work, the issue might be in the sync logic');
    console.log('3. If neither work, update the credentials');
    console.log('4. Make sure you\'re testing the right store URL');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testBothWooConnections();
