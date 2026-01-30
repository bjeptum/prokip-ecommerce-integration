const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateWooCommerceCredentialsNew() {
  console.log('🔧 Update WooCommerce Credentials');
  console.log('===============================');

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
    console.log(`   Current Consumer Key: ${connection.consumerKey?.substring(0, 20)}...`);
    console.log(`   Current Consumer Secret: ${connection.consumerSecret?.substring(0, 20)}...`);

    // 2. Update with new credentials (you'll need to modify these)
    console.log('\n2️⃣ Update with new credentials...');
    console.log('⚠️  IMPORTANT: Update the values below with your new credentials!');
    
    // NEW CREDENTIALS - UPDATE THESE VALUES
    const newConsumerKey = 'ck_your_new_consumer_key_here';
    const newConsumerSecret = 'cs_your_new_consumer_secret_here';
    
    // For Application Password method
    const newUsername = 'your_wordpress_username';
    const newAppPassword = 'your_generated_app_password';
    
    // Choose which method to use
    const useAppPassword = false; // Set to true if using Application Password
    
    if (useAppPassword) {
      // Update with Application Password
      await prisma.connection.update({
        where: { id: connection.id },
        data: {
          username: newUsername,
          appPassword: newAppPassword,
          // Clear old credentials
          consumerKey: null,
          consumerSecret: null,
          accessToken: null,
          accessTokenSecret: null
        }
      });
      
      console.log('✅ Updated with Application Password credentials');
      console.log(`   Username: ${newUsername}`);
      console.log(`   App Password: ${newAppPassword.substring(0, 10)}...`);
      
    } else {
      // Update with Consumer Key/Secret
      await prisma.connection.update({
        where: { id: connection.id },
        data: {
          consumerKey: newConsumerKey,
          consumerSecret: newConsumerSecret,
          // Clear other credentials
          username: null,
          appPassword: null,
          accessToken: null,
          accessTokenSecret: null
        }
      });
      
      console.log('✅ Updated with Consumer Key/Secret credentials');
      console.log(`   Consumer Key: ${newConsumerKey.substring(0, 20)}...`);
      console.log(`   Consumer Secret: ${newConsumerSecret.substring(0, 20)}...`);
    }

    // 3. Test the new credentials
    console.log('\n3️⃣ Testing new credentials...');
    const axios = require('axios');
    const wooBaseUrl = connection.storeUrl.replace(/\/$/, '') + '/wp-json/wc/v3/';
    
    let client;
    if (useAppPassword) {
      // Application Password method
      client = axios.create({
        baseURL: wooBaseUrl,
        auth: {
          username: newUsername,
          password: newAppPassword
        },
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Prokip-Integration/1.0'
        },
        timeout: 15000
      });
    } else {
      // Consumer Key method
      client = axios.create({
        baseURL: wooBaseUrl,
        auth: {
          username: newConsumerKey,
          password: newConsumerSecret
        },
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Prokip-Integration/1.0'
        },
        timeout: 15000
      });
    }

    try {
      const response = await client.get('system_status');
      console.log('✅ New credentials work!');
      console.log(`   WooCommerce Version: ${response.data.data?.woocommerce_version || 'Unknown'}`);
      
      // Test webhook creation
      console.log('\n4️⃣ Testing webhook creation...');
      const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/connections/webhook/woocommerce';
      
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
      console.log('\n📋 FINAL SETUP:');
      console.log('1. ✅ Credentials updated and tested');
      console.log('2. ✅ Webhook creation permissions verified');
      console.log('3. ✅ Ready to create production webhooks');
      
      console.log('\n🔧 NEXT STEPS:');
      console.log('1. Set up public webhook URL (ngrok if using localhost)');
      console.log('2. Run the webhook creation script');
      console.log('3. Test with a real WooCommerce order');
      
    } catch (error) {
      console.error('❌ New credentials failed:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        console.log('\n🔧 Credentials still have permission issues.');
        console.log('Make sure:');
        console.log('- Consumer Key has "Read/Write" permissions');
        console.log('- User has administrator privileges');
        console.log('- WooCommerce REST API is enabled');
      }
    }

  } catch (error) {
    console.error('❌ Update failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Instructions
console.log('📋 INSTRUCTIONS:');
console.log('================');
console.log('1. Get new WooCommerce credentials with Read/Write permissions');
console.log('2. Update the credential values in this script');
console.log('3. Set useAppPassword = true if using Application Password');
console.log('4. Run: node update-woo-credentials-new.js');
console.log('5. Follow the on-screen instructions');

console.log('\n⚠️  IMPORTANT: Edit the script with your new credentials before running!');

// Uncomment the line below after updating credentials
// updateWooCommerceCredentialsNew();
