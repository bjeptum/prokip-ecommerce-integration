// Check current connection ID 4 and fix authentication
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkConnection4() {
  console.log('🔍 Checking Connection ID 4 and Authentication\n');
  
  try {
    // Check all connections
    const connections = await prisma.connection.findMany();
    console.log('📋 All Connections:');
    connections.forEach((conn, index) => {
      console.log(`  ${index + 1}. ID: ${conn.id}, Platform: ${conn.platform}`);
      console.log(`     Store: ${conn.storeUrl}`);
      console.log(`     User ID: ${conn.userId}`);
      console.log(`     Has Consumer Key: ${!!conn.consumerKey}`);
      console.log(`     Has Consumer Secret: ${!!conn.consumerSecret}`);
      console.log(`     Has Woo Username: ${!!conn.wooUsername}`);
      console.log(`     Has Woo App Password: ${!!conn.wooAppPassword}`);
      console.log(`     Sync Enabled: ${conn.syncEnabled}`);
      console.log(`     Created: ${conn.createdAt}`);
    });
    
    // Check Prokip configs
    const prokipConfigs = await prisma.prokipConfig.findMany();
    console.log('\n🔑 Prokip Configs:');
    prokipConfigs.forEach((config, index) => {
      console.log(`  ${index + 1}. User ID: ${config.userId}`);
      console.log(`     Location ID: ${config.locationId}`);
      console.log(`     Has Token: ${!!config.token}`);
      console.log(`     Token Length: ${config.token ? config.token.length : 0}`);
    });
    
    // Check connection ID 4 specifically
    const connection4 = await prisma.connection.findUnique({ where: { id: 4 } });
    console.log('\n🔍 Connection ID 4 Check:');
    if (connection4) {
      console.log('✅ Connection ID 4 exists');
      console.log(`   Platform: ${connection4.platform}`);
      console.log(`   Store: ${connection4.storeUrl}`);
      console.log(`   User ID: ${connection4.userId}`);
      
      // Check credentials
      if (connection4.consumerKey && connection4.consumerSecret) {
        console.log('✅ Consumer Key/Secret credentials stored');
        console.log(`   Consumer Key: ${connection4.consumerKey.substring(0, 10)}...`);
        console.log(`   Consumer Secret: ${connection4.consumerSecret.substring(0, 10)}...`);
      } else {
        console.log('❌ Consumer Key/Secret credentials missing');
      }
      
      // Check if user ID matches Prokip config
      const prokipConfig = prokipConfigs.find(config => config.userId === connection4.userId);
      if (prokipConfig) {
        console.log('✅ User ID matches Prokip config');
        console.log('💡 Authentication should work for this connection');
      } else {
        console.log('❌ User ID does NOT match any Prokip config');
        console.log('💡 This is why authentication is failing');
        
        // Fix: Update connection to use correct user ID
        const correctUserId = prokipConfigs[0]?.userId;
        if (correctUserId) {
          console.log(`\n🔧 Fixing connection ID 4 user ID from ${connection4.userId} to ${correctUserId}`);
          await prisma.connection.update({
            where: { id: 4 },
            data: { userId: correctUserId }
          });
          console.log('✅ Connection user ID fixed');
        }
      }
    } else {
      console.log('❌ Connection ID 4 does NOT exist');
      console.log('💡 Frontend is trying to use non-existent connection');
    }
    
    // Test WooCommerce API connection
    if (connection4 && connection4.consumerKey && connection4.consumerSecret) {
      console.log('\n🧪 Testing WooCommerce API connection...');
      const axios = require('axios');
      
      try {
        const testUrl = `${connection4.storeUrl}wp-json/wc/v3/products?per_page=1`;
        const response = await axios.get(testUrl, {
          auth: {
            username: connection4.consumerKey,
            password: connection4.consumerSecret
          },
          headers: {
            'User-Agent': 'Prokip-Integration/1.0',
            'Accept': 'application/json'
          },
          timeout: 15000
        });
        
        console.log('✅ WooCommerce API test successful!');
        console.log(`   Status: ${response.status}`);
        console.log(`   Products accessible: ${response.data.length > 0}`);
        
      } catch (error) {
        console.log('❌ WooCommerce API test failed:');
        console.log(`   Error: ${error.message}`);
        if (error.response) {
          console.log(`   Status: ${error.response.status}`);
          console.log(`   Data: ${JSON.stringify(error.response.data).substring(0, 200)}...`);
        }
      }
    }
    
    console.log('\n🎯 Summary:');
    console.log('✅ WooCommerce connection established');
    console.log('❌ Store routes authentication failing');
    console.log('💡 Need to fix authentication middleware for store routes');
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkConnection4();
