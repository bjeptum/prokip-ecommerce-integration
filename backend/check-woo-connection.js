// Check and reset WooCommerce connection
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAndResetWooCommerce() {
  console.log('🔍 Checking WooCommerce connection...\n');
  
  try {
    // Check current connection
    const connection = await prisma.connection.findUnique({ where: { id: 1 } });
    
    if (connection) {
      console.log('📋 Current WooCommerce connection:');
      console.log(`  ID: ${connection.id}`);
      console.log(`  Platform: ${connection.platform}`);
      console.log(`  Store URL: ${connection.storeUrl}`);
      console.log(`  User ID: ${connection.userId}`);
      console.log(`  Sync Enabled: ${connection.syncEnabled}`);
      console.log(`  Created: ${connection.createdAt}`);
      console.log(`  Last Sync: ${connection.lastSync}`);
      console.log(`  Has Username: ${!!connection.wooUsername}`);
      console.log(`  Has Password: ${!!connection.wooAppPassword}`);
      
      // Check if credentials are encrypted or missing
      if (!connection.wooUsername || !connection.wooAppPassword) {
        console.log('\n❌ WooCommerce credentials missing or corrupted');
        console.log('🔧 Resetting connection...');
        
        // Reset the connection
        await prisma.connection.delete({ where: { id: 1 } });
        console.log('✅ Connection deleted - ready for fresh connection');
        
        console.log('\n📋 Next steps:');
        console.log('1. Go to frontend and reconnect WooCommerce');
        console.log('2. Use your Consumer Key & Secret');
        console.log('3. Test connection');
        console.log('4. Products and orders should load');
        
      } else {
        console.log('\n✅ WooCommerce credentials exist');
        console.log('🔍 Testing connection...');
        
        // Test the connection
        const axios = require('axios');
        try {
          const testUrl = `${connection.storeUrl}wp-json/wc/v3/products?per_page=1`;
          const response = await axios.get(testUrl, {
            auth: {
              username: connection.wooUsername,
              password: connection.wooAppPassword
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
          
          console.log('\n🔧 Resetting connection due to invalid credentials...');
          await prisma.connection.delete({ where: { id: 1 } });
          console.log('✅ Connection deleted - ready for fresh connection');
          
          console.log('\n📋 Next steps:');
          console.log('1. Go to frontend and reconnect WooCommerce');
          console.log('2. Use valid Consumer Key & Secret');
          console.log('3. Test connection');
          console.log('4. Products and orders should load');
        }
      }
    } else {
      console.log('❌ No WooCommerce connection found');
      console.log('🔧 Ready for fresh connection');
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndResetWooCommerce();
