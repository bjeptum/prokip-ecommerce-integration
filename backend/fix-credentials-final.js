const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function fixCredentialsFinal() {
  try {
    console.log('🔧 FINAL FIX: Update WooCommerce credentials');
    console.log('=' .repeat(60));
    
    // Get the connection
    const wooConnection = await prisma.connection.findFirst({ where: { platform: 'woocommerce' } });
    
    if (!wooConnection) {
      console.log('❌ No WooCommerce connection found');
      return;
    }
    
    console.log(`🌐 Store URL: ${wooConnection.storeUrl}`);
    
    // Test with a working set of credentials
    const workingCredentials = {
      consumerKey: 'ck_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c',
      consumerSecret: 'cs_3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a'
    };
    
    console.log('\n🧪 Testing with working credentials...');
    
    const testHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${workingCredentials.consumerKey}:${workingCredentials.consumerSecret}`).toString('base64')}`
    };
    
    try {
      const testResponse = await axios.get(`${wooConnection.storeUrl}/wp-json/wc/v3/system_status`, { headers: testHeaders });
      console.log('✅ Working credentials found!');
      
      // Update the database
      await prisma.connection.update({
        where: { id: wooConnection.id },
        data: {
          consumerKey: workingCredentials.consumerKey,
          consumerSecret: workingCredentials.consumerSecret
        }
      });
      
      console.log('✅ Database updated with working credentials!');
      
      // Test the sync
      console.log('\n🔄 Testing bidirectional sync...');
      const syncResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('✅ Sync response:', syncResponse.data);
      
      if (syncResponse.data.success) {
        console.log('\n🎉 SUCCESS! The bidirectional sync is now working!');
        console.log('💡 WooCommerce sales will now deduct stock from Prokip');
        console.log('💡 Prokip sales will now deduct stock from WooCommerce');
      }
      
    } catch (error) {
      console.log('❌ Test failed:', error.response?.status);
      
      console.log('\n💡 MANUAL INSTRUCTIONS:');
      console.log('1. Go to your WooCommerce admin panel');
      console.log('2. Navigate to: WooCommerce > Settings > Advanced > REST API');
      console.log('3. Click "Add Key"');
      console.log('4. Enter Description: "Prokip Integration"');
      console.log('5. Set Permissions: "Read/Write"');
      console.log('6. Click "Generate API Key"');
      console.log('7. Copy the Consumer Key and Consumer Secret');
      console.log('8. Run this SQL to update the database:');
      console.log('');
      console.log('UPDATE connection SET');
      console.log('  consumerKey = \'ck_your_new_consumer_key\',');
      console.log('  consumerSecret = \'cs_your_new_consumer_secret\'');
      console.log('WHERE platform = \'woocommerce\';');
    }
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixCredentialsFinal();
