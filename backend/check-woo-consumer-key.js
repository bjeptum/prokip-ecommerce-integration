// Check current WooCommerce connection with Consumer Key/Secret
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkWooCommerceConnection() {
  console.log('🔍 Checking WooCommerce connection with Consumer Key/Secret...\n');
  
  try {
    // Check all connections
    const connections = await prisma.connection.findMany();
    console.log('📋 All connections:');
    connections.forEach((conn, index) => {
      console.log(`  ${index + 1}. ID: ${conn.id}, Platform: ${conn.platform}`);
      console.log(`     Store: ${conn.storeUrl}`);
      console.log(`     User ID: ${conn.userId}`);
      console.log(`     Has Consumer Key: ${!!conn.consumerKey}`);
      console.log(`     Has Consumer Secret: ${!!conn.consumerSecret}`);
      console.log(`     Has Woo Username: ${!!conn.wooUsername}`);
      console.log(`     Has Woo App Password: ${!!conn.wooAppPassword}`);
      console.log(`     Sync Enabled: ${conn.syncEnabled}`);
    });
    
    // Find the WooCommerce connection
    const wooConnection = connections.find(conn => conn.platform === 'woocommerce');
    if (wooConnection) {
      console.log('\n✅ WooCommerce connection found:');
      console.log(`   Connection ID: ${wooConnection.id}`);
      console.log(`   Store URL: ${wooConnection.storeUrl}`);
      console.log(`   User ID: ${wooConnection.userId}`);
      
      // Check which credentials are stored
      if (wooConnection.consumerKey && wooConnection.consumerSecret) {
        console.log('   ✅ Consumer Key/Secret credentials stored');
        
        // Test the connection
        console.log('\n🧪 Testing WooCommerce connection...');
        const axios = require('axios');
        try {
          const testUrl = `${wooConnection.storeUrl}wp-json/wc/v3/products?per_page=1`;
          const response = await axios.get(testUrl, {
            auth: {
              username: wooConnection.consumerKey,
              password: wooConnection.consumerSecret
            },
            headers: {
              'User-Agent': 'Prokip-Integration/1.0',
              'Accept': 'application/json'
            },
            timeout: 10000
          });
          
          console.log('✅ WooCommerce connection test successful!');
          console.log(`   Status: ${response.status}`);
          console.log(`   Products accessible: ${response.data.length > 0}`);
          
        } catch (error) {
          console.log('❌ WooCommerce connection test failed:');
          console.log(`   Error: ${error.message}`);
          if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Data: ${JSON.stringify(error.response.data).substring(0, 200)}...`);
          }
        }
      } else {
        console.log('   ❌ Consumer Key/Secret credentials missing');
        console.log('   💡 Need to reconnect with Consumer Key/Secret');
      }
    } else {
      console.log('❌ No WooCommerce connection found');
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkWooCommerceConnection();
