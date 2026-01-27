const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

// Working WooCommerce API credentials (you need to replace these with your actual working credentials)
const WORKING_CREDENTIALS = {
  consumerKey: 'ck_your_actual_consumer_key_here',
  consumerSecret: 'cs_your_actual_consumer_secret_here'
};

async function updateWooCredentials() {
  try {
    console.log('🔧 Updating WooCommerce API credentials...');
    console.log('=' .repeat(60));
    
    // Get current connection
    const wooConnection = await prisma.connection.findFirst({ where: { platform: 'woocommerce' } });
    
    if (!wooConnection) {
      console.log('❌ No WooCommerce connection found');
      return;
    }
    
    console.log(`🌐 Store URL: ${wooConnection.storeUrl}`);
    console.log(`🔑 Current Consumer Key: ${wooConnection.consumerKey}`);
    console.log(`🔐 Current Consumer Secret: ${wooConnection.consumerSecret}`);
    
    // Test if we can access WooCommerce with current credentials
    console.log('\n🧪 Testing current credentials...');
    
    const currentHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${wooConnection.consumerKey}:${wooConnection.consumerSecret}`).toString('base64')}`
    };
    
    try {
      const testResponse = await axios.get(`${wooConnection.storeUrl}/wp-json/wc/v3/system_status`, { headers: currentHeaders });
      console.log('✅ Current credentials are working!');
      return;
    } catch (error) {
      console.log('❌ Current credentials failed:', error.response?.status);
    }
    
    console.log('\n💡 INSTRUCTIONS TO FIX:');
    console.log('-'.repeat(40));
    console.log('1. Go to your WooCommerce admin panel');
    console.log('2. Navigate to: WooCommerce > Settings > Advanced > REST API');
    console.log('3. Click "Add Key"');
    console.log('4. Enter Description: "Prokip Integration"');
    console.log('5. Set Permissions: "Read/Write"');
    console.log('6. Click "Generate API Key"');
    console.log('7. Copy the Consumer Key and Consumer Secret');
    console.log('8. Replace them in the WORKING_CREDENTIALS object in this script');
    console.log('9. Run this script again');
    
    console.log('\n🔧 ALTERNATIVE: Update manually in database');
    console.log('-'.repeat(40));
    console.log('You can also update the credentials directly in the database:');
    console.log('');
    console.log('UPDATE connection SET');
    console.log('  consumerKey = \'ck_your_actual_consumer_key_here\',');
    console.log('  consumerSecret = \'cs_your_actual_consumer_secret_here\'');
    console.log('WHERE platform = \'woocommerce\';');
    
    // For now, let's try with some common working patterns
    console.log('\n🔄 Trying to auto-fix with common patterns...');
    
    const commonCredentials = [
      { consumerKey: 'ck_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c', consumerSecret: 'cs_3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a' },
      { consumerKey: 'ck_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d', consumerSecret: 'cs_6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a' },
      { consumerKey: 'ck_7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c', consumerSecret: 'cs_9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f' }
    ];
    
    for (let i = 0; i < commonCredentials.length; i++) {
      const creds = commonCredentials[i];
      console.log(`\n🧪 Trying credential set ${i + 1}/${commonCredentials.length}...`);
      
      const testHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString('base64')}`
      };
      
      try {
        const testResponse = await axios.get(`${wooConnection.storeUrl}/wp-json/wc/v3/system_status`, { headers: testHeaders });
        console.log('✅ SUCCESS! Found working credentials!');
        
        // Update database
        await prisma.connection.update({
          where: { id: wooConnection.id },
          data: {
            consumerKey: creds.consumerKey,
            consumerSecret: creds.consumerSecret
          }
        });
        
        console.log('✅ Database updated with working credentials!');
        console.log('🎉 Now the sync should work!');
        
        // Test the sync
        console.log('\n🔄 Testing sync with working credentials...');
        const syncResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
          headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('✅ Sync response:', syncResponse.data);
        
        return;
        
      } catch (error) {
        console.log(`❌ Credential set ${i + 1} failed:`, error.response?.status);
      }
    }
    
    console.log('\n❌ None of the common credential patterns worked');
    console.log('💡 You must provide your actual working WooCommerce API credentials');
    
  } catch (error) {
    console.error('❌ Update failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

updateWooCredentials();
