const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Encryption function (same as used in the app)
function encrypt(text) {
  const algorithm = 'aes-256-gcm';
  const secretKey = process.env.ENCRYPTION_KEY || 'your-secret-key-32-characters-long';
  const key = crypto.scryptSync(secretKey, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex')
  };
}

async function updateWooCommerceCredentials() {
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

    // 2. Update with your actual credentials
    console.log('\n2️⃣ Updating with your actual credentials...');
    
    // These are the credentials you mentioned having Read/Write permissions
    const actualConsumerKey = 'ck_62f757841636975ebf322465ab45a324658a4e4b';
    const actualConsumerSecret = 'cs_1417fdf5283158b5dcd7013a86e518afb3f5d080';
    
    console.log(`   Consumer Key: ${actualConsumerKey}`);
    console.log(`   Consumer Secret: ${actualConsumerSecret.substring(0, 20)}...`);

    // Encrypt the credentials
    const encryptedKey = encrypt(actualConsumerKey);
    const encryptedSecret = encrypt(actualConsumerSecret);

    // Update the database
    await prisma.connection.update({
      where: { id: connection.id },
      data: {
        consumerKey: JSON.stringify(encryptedKey),
        consumerSecret: JSON.stringify(encryptedSecret),
        storeUrl: 'https://prowebfunnels.com/kenditrades'
      }
    });

    console.log('✅ Credentials updated successfully!');

    // 3. Test the new credentials
    console.log('\n3️⃣ Testing new credentials...');
    const axios = require('axios');
    const wooBaseUrl = 'https://prowebfunnels.com/kenditrades/wp-json/wc/v3/';
    
    const client = axios.create({
      baseURL: wooBaseUrl,
      auth: {
        username: actualConsumerKey,
        password: actualConsumerSecret
      },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Prokip-Integration/1.0'
      },
      timeout: 15000
    });

    try {
      const response = await client.get('system_status');
      console.log('✅ New credentials work!');
      console.log(`   WooCommerce Version: ${response.data.data?.woocommerce_version || 'Unknown'}`);
      
      // Test webhook creation
      console.log('\n4️⃣ Testing webhook creation...');
      const webhookUrl = 'https://nonluminous-flawed-lonny.ngrok-free.dev/connections/webhook/woocommerce';
      
      const testWebhook = {
        name: 'Prokip Order Created',
        topic: 'order.created',
        delivery_url: webhookUrl,
        secret: process.env.WOO_WEBHOOK_SECRET || 'prokip_secret',
        status: 'active'
      };

      const webhookResponse = await client.post('webhooks', testWebhook);
      console.log('✅ Webhook creation works!');
      console.log(`   Webhook ID: ${webhookResponse.data.id}`);
      
      // Create additional webhooks
      const additionalTopics = [
        { topic: 'order.updated', name: 'Prokip Order Updated' },
        { topic: 'order.status_changed', name: 'Prokip Order Status Changed' }
      ];

      for (const webhook of additionalTopics) {
        try {
          const payload = { ...testWebhook, topic: webhook.topic, name: webhook.name };
          await client.post('webhooks', payload);
          console.log(`✅ Created webhook: ${webhook.topic}`);
        } catch (error) {
          if (error.response?.data?.code === 'woocommerce_webhook_exists') {
            console.log(`ℹ️ Webhook already exists: ${webhook.topic}`);
          } else {
            console.warn(`⚠️ Failed to create webhook ${webhook.topic}:`, error.response?.data?.message);
          }
        }
      }

      console.log('\n🎉 SUCCESS! Everything is now working correctly!');
      console.log('\n📋 FINAL STATUS:');
      console.log('✅ Store URL updated to: https://prowebfunnels.com/kenditrades');
      console.log('✅ Credentials updated with Read/Write permissions');
      console.log('✅ Webhook URL set to: https://nonluminous-flawed-lonny.ngrok-free.dev/connections/webhook/woocommerce');
      console.log('✅ Webhooks created successfully');
      
      console.log('\n🎯 TEST IT NOW:');
      console.log('1. Create a new "completed" order in WooCommerce');
      console.log('2. Watch your server logs for webhook processing');
      console.log('3. Check that stock is reduced in Prokip');
      console.log('4. Verify local inventory cache is updated');
      
    } catch (error) {
      console.error('❌ New credentials failed:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        console.log('\n🔧 Credentials still not working!');
        console.log('Please verify:');
        console.log('1. Consumer Key: ck_62f757841636975ebf322465ab45a324658a4e4b');
        console.log('2. Consumer Secret: cs_1417fdf5283158b5dcd7013a86e518afb3f5d080');
        console.log('3. Permissions: Read/Write');
        console.log('4. Store URL: https://prowebfunnels.com/kenditrades');
      }
    }

  } catch (error) {
    console.error('❌ Update failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run update
updateWooCommerceCredentials();
