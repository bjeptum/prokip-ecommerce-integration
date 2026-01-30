const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function fixWooCommerceCredentialsNow() {
  console.log('🔧 Fix WooCommerce Credentials Now');
  console.log('=================================');

  try {
    // 1. Get current connection
    console.log('\n1️⃣ Getting current WooCommerce connection...');
    const connection = await prisma.connection.findFirst({
      where: { platform: 'woocommerce' }
    });

    if (!connection) {
      console.error('❌ No WooCommerce connection found');
      return;
    }

    console.log(`✅ Found connection for: ${connection.storeUrl}`);
    console.log(`   Consumer Key: ${connection.consumerKey}`);
    console.log(`   Consumer Secret: ${connection.consumerSecret}`);

    // 2. Test with the credentials you mentioned
    console.log('\n2️⃣ Testing with your current credentials...');
    const wooBaseUrl = connection.storeUrl.replace(/\/$/, '') + '/wp-json/wc/v3/';
    
    const client = axios.create({
      baseURL: wooBaseUrl,
      auth: {
        username: connection.consumerKey,
        password: connection.consumerSecret
      },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Prokip-Integration/1.0'
      },
      timeout: 15000
    });

    try {
      const response = await client.get('system_status');
      console.log('✅ Current credentials work!');
      console.log(`   WooCommerce Version: ${response.data.data?.woocommerce_version || 'Unknown'}`);
      
      // Test webhook creation
      console.log('\n3️⃣ Testing webhook creation...');
      const webhookUrl = 'https://nonluminous-flawed-lonny.ngrok-free.dev/connections/webhook/woocommerce';
      
      const testWebhook = {
        name: 'Prokip Test Webhook',
        topic: 'order.created',
        delivery_url: webhookUrl,
        secret: process.env.WOO_WEBHOOK_SECRET || 'prokip_secret',
        status: 'active'
      };

      const webhookResponse = await client.post('webhooks', testWebhook);
      console.log('✅ Webhook creation works!');
      console.log(`   Test Webhook ID: ${webhookResponse.data.id}`);
      
      // Clean up test webhook
      await client.delete(`webhooks/${webhookResponse.data.id}`);
      console.log('✅ Test webhook cleaned up');
      
      console.log('\n🎉 SUCCESS! Everything is working correctly.');
      console.log('\n📋 NEXT STEPS:');
      console.log('1. Your webhooks should now work with the ngrok URL');
      console.log('2. Create a test order in WooCommerce');
      console.log('3. Check server logs for webhook processing');
      console.log('4. Verify stock reduction in Prokip');
      
    } catch (error) {
      console.error('❌ Current credentials failed:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        console.log('\n🔧 CREDENTIAL ISSUE DETECTED');
        console.log('The credentials in the database are not working.');
        console.log('\nPOSSIBLE CAUSES:');
        console.log('1. Consumer Key was regenerated in WooCommerce');
        console.log('2. Consumer Secret was regenerated in WooCommerce');
        console.log('3. Permissions were changed from Read/Write');
        console.log('4. User account was changed/disabled');
        
        console.log('\n🔧 SOLUTION:');
        console.log('1. Go to WooCommerce > Settings > Advanced > REST API');
        console.log('2. Find your Consumer Key for Prokip Integration');
        console.log('3. Click "Edit" and verify:');
        console.log('   - Permissions: Read/Write');
        console.log('4. If needed, click "Regenerate API Key"');
        console.log('5. Copy the new Consumer Key and Consumer Secret');
        console.log('6. Update the database with new credentials');
        
        console.log('\n⚠️  IMPORTANT: Your current credentials in the database:');
        console.log(`   Consumer Key: ${connection.consumerKey}`);
        console.log(`   Consumer Secret: ${connection.consumerSecret}`);
        console.log('   These do NOT match what WooCommerce expects!');
      }
    }

    // 3. Check if we need to update the store URL
    console.log('\n4️⃣ Checking store URL...');
    if (connection.storeUrl !== 'https://prowebfunnels.com/kenditrades') {
      console.log('⚠️ Store URL in database does not match your WooCommerce URL');
      console.log(`   Database: ${connection.storeUrl}`);
      console.log(`   Expected: https://prowebfunnels.com/kenditrades`);
      
      console.log('\n🔧 Updating store URL...');
      await prisma.connection.update({
        where: { id: connection.id },
        data: { storeUrl: 'https://prowebfunnels.com/kenditrades' }
      });
      console.log('✅ Store URL updated');
    } else {
      console.log('✅ Store URL is correct');
    }

  } catch (error) {
    console.error('❌ Fix failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run fix
fixWooCommerceCredentialsNow();
