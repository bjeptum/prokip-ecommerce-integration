const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function fixWooCredentials() {
  try {
    console.log('🔧 Fixing WooCommerce API credentials...');
    
    // Get the WooCommerce connection
    const connection = await prisma.connection.findFirst({
      where: { platform: 'woocommerce' }
    });
    
    if (!connection) {
      console.log('❌ No WooCommerce connection found');
      return;
    }
    
    console.log('📋 Current WooCommerce connection:');
    console.log(`- Store URL: ${connection.storeUrl}`);
    console.log(`- Consumer Key: ${connection.consumerKey ? 'Present' : 'Missing'}`);
    console.log(`- Consumer Secret: ${connection.consumerSecret ? 'Present' : 'Missing'}`);
    
    // Test different credential combinations
    const testCredentials = [
      {
        consumerKey: 'ck_1234567890abcdef',
        consumerSecret: 'cs_1234567890abcdef'
      },
      {
        consumerKey: 'ck_prokip_test_key',
        consumerSecret: 'cs_prokip_test_secret'
      }
    ];
    
    for (const creds of testCredentials) {
      console.log(`\n🧪 Testing credentials: ${creds.consumerKey.substring(0, 10)}...`);
      
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString('base64')}`
      };
      
      try {
        const response = await axios.get(`${connection.storeUrl}/wp-json/wc/v3/system_status`, { headers });
        
        if (response.status === 200) {
          console.log('✅ Credentials work! Updating database...');
          
          // Update the connection with working credentials
          await prisma.connection.update({
            where: { id: connection.id },
            data: {
              consumerKey: creds.consumerKey,
              consumerSecret: creds.consumerSecret
            }
          });
          
          console.log('✅ WooCommerce credentials updated successfully');
          return;
        }
      } catch (error) {
        console.log(`❌ Credentials failed: ${error.response?.status} ${error.response?.data?.message || error.message}`);
      }
    }
    
    console.log('\n❌ No working credentials found. You may need to:');
    console.log('1. Check your WooCommerce store URL');
    console.log('2. Generate new API keys in WooCommerce');
    console.log('3. Ensure the keys have proper permissions');
    
  } catch (error) {
    console.error('❌ Error fixing credentials:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixWooCredentials();
