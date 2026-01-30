const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function createWooCommerceWebhookManually() {
  console.log('🔧 Creating WooCommerce Webhook Manually');
  console.log('=======================================');

  try {
    // 1. Get WooCommerce connection details
    console.log('\n1️⃣ Getting WooCommerce connection...');
    const connection = await prisma.connection.findFirst({
      where: { platform: 'woocommerce' }
    });

    if (!connection) {
      console.error('❌ No WooCommerce connection found');
      return;
    }

    console.log(`✅ Store: ${connection.storeUrl}`);
    console.log(`   Consumer Key: ${connection.consumerKey ? 'Present' : 'Missing'}`);
    console.log(`   Consumer Secret: ${connection.consumerSecret ? 'Present' : 'Missing'}`);

    // 2. Create webhook via WooCommerce REST API
    console.log('\n2️⃣ Creating webhook via WooCommerce API...');
    
    const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/connections/webhook/woocommerce';
    const wooBaseUrl = connection.storeUrl.replace(/\/$/, '') + '/wp-json/wc/v3/';
    
    console.log(`   WooCommerce URL: ${wooBaseUrl}`);
    console.log(`   Webhook URL: ${webhookUrl}`);

    // Create axios client with Basic Auth
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

    // Webhook payload
    const webhookPayload = {
      name: 'Prokip Order Sync',
      topic: 'order.created',
      delivery_url: webhookUrl,
      secret: process.env.WOO_WEBHOOK_SECRET || 'prokip_secret',
      status: 'active'
    };

    console.log('   Creating webhook...');
    try {
      const response = await client.post('webhooks', webhookPayload);
      console.log('✅ Webhook created successfully!');
      console.log(`   Webhook ID: ${response.data.id}`);
      console.log(`   Topic: ${response.data.topic}`);
      console.log(`   Delivery URL: ${response.data.delivery_url}`);
      
      // Create additional webhooks for comprehensive tracking
      const additionalWebhooks = [
        { topic: 'order.updated', name: 'Prokip Order Updates' },
        { topic: 'order.status_changed', name: 'Prokip Order Status Changes' }
      ];

      for (const webhook of additionalWebhooks) {
        try {
          const payload = {
            ...webhookPayload,
            topic: webhook.topic,
            name: webhook.name
          };
          
          const response = await client.post('webhooks', payload);
          console.log(`✅ Additional webhook created: ${webhook.topic}`);
        } catch (error) {
          if (error.response?.data?.code === 'woocommerce_webhook_exists') {
            console.log(`ℹ️ Webhook already exists: ${webhook.topic}`);
          } else {
            console.warn(`⚠️ Failed to create webhook ${webhook.topic}:`, error.response?.data || error.message);
          }
        }
      }

    } catch (error) {
      console.error('❌ Failed to create webhook:', error.response?.data || error.message);
      
      // Check if webhook already exists
      if (error.response?.data?.code === 'woocommerce_webhook_exists') {
        console.log('ℹ️ Webhook already exists, checking existing webhooks...');
        
        try {
          const { data: existingWebhooks } = await client.get('webhooks');
          const prokipWebhooks = existingWebhooks.filter(w => 
            w.delivery_url.includes('prokip') || w.name.includes('Prokip')
          );
          
          console.log(`✅ Found ${prokipWebhooks.length} existing Prokip webhooks:`);
          prokipWebhooks.forEach(webhook => {
            console.log(`   - ${webhook.name} (${webhook.topic}) - ${webhook.status}`);
          });
          
          if (prokipWebhooks.length > 0) {
            console.log('\n🔄 Testing existing webhook...');
            // Test by pinging the webhook
            try {
              await client.post(`webhooks/${prokipWebhooks[0].id}/deliveries`);
              console.log('✅ Webhook ping sent successfully');
            } catch (pingError) {
              console.warn('⚠️ Failed to ping webhook:', pingError.message);
            }
          }
          
        } catch (listError) {
          console.error('❌ Failed to list existing webhooks:', listError.message);
        }
      }
    }

    // 3. Test webhook endpoint
    console.log('\n3️⃣ Testing webhook endpoint...');
    try {
      const testResponse = await axios.get(webhookUrl, {
        timeout: 5000,
        validateStatus: (status) => status < 500
      });
      console.log(`✅ Webhook endpoint accessible (Status: ${testResponse.status})`);
    } catch (error) {
      console.error('❌ Webhook endpoint not accessible:', error.message);
      
      if (webhookUrl.includes('localhost')) {
        console.log('\n💡 SOLUTION: Use a public URL for webhooks');
        console.log('1. Install ngrok: npm install -g ngrok');
        console.log('2. Run: ngrok http 3000');
        console.log('3. Update WEBHOOK_URL in .env to the ngrok URL');
        console.log('4. Restart the server');
        console.log('5. Recreate the webhook');
      }
    }

    console.log('\n✅ Webhook setup completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Create a test order in WooCommerce');
    console.log('2. Check server logs for webhook receipt');
    console.log('3. Verify stock reduction in Prokip');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run setup
createWooCommerceWebhookManually();
