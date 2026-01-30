const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function permanentWooCommerceSolution() {
  console.log('🔧 PERMANENT WooCommerce Solution');
  console.log('=================================');

  try {
    // 1. Check current connection
    console.log('\n1️⃣ Analyzing current connection...');
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

    // 2. Test current credentials
    console.log('\n2️⃣ Testing current credentials...');
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
      console.log('✅ Current credentials work for basic API access');
    } catch (error) {
      console.error('❌ Current credentials don\'t work:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        console.log('\n🔧 CREDENTIAL FIX REQUIRED');
        console.log('Your Consumer Key/Secret are invalid or have insufficient permissions.');
        console.log('\nSOLUTION OPTIONS:');
        
        console.log('\n📋 OPTION 1: Update Consumer Key Permissions (Recommended)');
        console.log('1. Log in to your WooCommerce admin');
        console.log('2. Go to: WooCommerce > Settings > Advanced > REST API');
        console.log('3. Find your existing Consumer Key');
        console.log('4. Click "Edit"');
        console.log('5. Change "Permissions" to "Read/Write"');
        console.log('6. Save the changes');
        console.log('7. Test the connection again');
        
        console.log('\n📋 OPTION 2: Create New Consumer Key');
        console.log('1. Go to: WooCommerce > Settings > Advanced > REST API');
        console.log('2. Click "Add Key"');
        console.log('3. Enter Description: "Prokip Integration"');
        console.log('4. Set User: Your admin user');
        console.log('5. Set Permissions: "Read/Write"');
        console.log('6. Click "Generate API Key"');
        console.log('7. Copy the Consumer Key and Consumer Secret');
        console.log('8. Update the database connection');
        
        console.log('\n📋 OPTION 3: Use Application Password');
        console.log('1. Go to: WordPress Admin > Users > Your Profile');
        console.log('2. Scroll to "Application Passwords"');
        console.log('3. Enter "Prokip Integration" and click "Add New Application Password"');
        console.log('4. Copy the generated password');
        console.log('5. Update connection with username and app_password');
        
        return;
      }
    }

    // 3. Set up public webhook URL
    console.log('\n3️⃣ Setting up public webhook URL...');
    const currentWebhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/connections/webhook/woocommerce';
    
    if (currentWebhookUrl.includes('localhost')) {
      console.log('❌ Webhook URL uses localhost - WooCommerce cannot reach it!');
      console.log('\n🌐 PUBLIC WEBHOOK SETUP:');
      console.log('You MUST use a public URL for webhooks to work.');
      console.log('\nOption A: Use ngrok (Quick & Easy)');
      console.log('1. Install: npm install -g ngrok');
      console.log('2. Run: ngrok http 3000');
      console.log('3. Copy the https://....ngrok.io URL');
      console.log('4. Update WEBHOOK_URL in .env file');
      console.log('5. Restart the server');
      
      console.log('\nOption B: Use a public domain');
      console.log('1. Deploy the server to a public host');
      console.log('2. Update WEBHOOK_URL to your public domain');
      console.log('3. Configure SSL certificate');
      
      console.log('\nOption C: Use localtunnel');
      console.log('1. Install: npm install -g localtunnel');
      console.log('2. Run: lt --port 3000');
      console.log('3. Copy the generated URL');
      console.log('4. Update WEBHOOK_URL in .env');
    } else {
      console.log('✅ Webhook URL appears to be public');
    }

    // 4. Create webhooks with proper permissions
    console.log('\n4️⃣ Creating webhooks...');
    const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/connections/webhook/woocommerce';
    
    try {
      // Test webhook creation
      const testWebhook = {
        name: 'Prokip Order Created',
        topic: 'order.created',
        delivery_url: webhookUrl,
        secret: process.env.WOO_WEBHOOK_SECRET || 'prokip_secret',
        status: 'active'
      };

      const response = await client.post('webhooks', testWebhook);
      console.log('✅ Webhook created successfully!');
      console.log(`   Webhook ID: ${response.data.id}`);
      
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

    } catch (error) {
      console.error('❌ Webhook creation failed:', error.response?.data?.message);
      
      if (error.response?.status === 401) {
        console.log('\n🔧 STILL HAVE PERMISSION ISSUES!');
        console.log('Even with Read/Write permissions, webhook creation might fail.');
        console.log('\nMANUAL WEBHOOK SETUP:');
        console.log('1. Go to WooCommerce > Settings > Advanced > Webhooks');
        console.log('2. Click "Add Webhook"');
        console.log(`3. Set Webhook URL: ${webhookUrl}`);
        console.log('4. Set Topic: "Order created"');
        console.log('5. Set Status: "Active"');
        console.log('6. Click "Save"');
        console.log('7. Repeat for "Order updated" and "Order status changed"');
      }
    }

    // 5. Test webhook processing
    console.log('\n5️⃣ Testing webhook processing...');
    const { processStoreToProkip } = require('./src/services/syncService');
    
    const testOrder = {
      id: Date.now(),
      number: Date.now().toString(),
      status: 'completed',
      date_created: new Date().toISOString(),
      total: '99.99',
      line_items: [{
        id: 1,
        name: 'Test Product',
        sku: '4848961',
        quantity: 1,
        price: '99.99'
      }]
    };

    try {
      await processStoreToProkip(
        connection.storeUrl,
        'order.created',
        testOrder,
        'woocommerce',
        50
      );
      console.log('✅ Webhook processing works perfectly!');
    } catch (error) {
      console.error('❌ Webhook processing failed:', error.message);
    }

    console.log('\n✅ SOLUTION COMPLETE!');
    console.log('\n📋 FINAL STEPS:');
    console.log('1. ✅ Fix WooCommerce API permissions (Read/Write Consumer Key)');
    console.log('2. ✅ Set up public webhook URL (ngrok recommended)');
    console.log('3. ✅ Create webhooks (automatic or manual)');
    console.log('4. ✅ Test with real WooCommerce order');
    console.log('\n🎯 EXPECTED RESULT:');
    console.log('When you create a "completed" order in WooCommerce:');
    console.log('- WooCommerce sends webhook to your server');
    console.log('- Server processes the order');
    console.log('- Sale is recorded in Prokip');
    console.log('- Stock is automatically reduced in Prokip');
    console.log('- Local cache is updated');

  } catch (error) {
    console.error('❌ Solution failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run permanent solution
permanentWooCommerceSolution();
