const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testNgrokWebhookConnection() {
  console.log('🌐 Testing Ngrok Webhook Connection');
  console.log('====================================');

  try {
    // 1. Test ngrok webhook accessibility
    console.log('\n1️⃣ Testing ngrok webhook endpoint...');
    const webhookUrl = 'https://nonluminous-flawed-lonny.ngrok-free.dev/connections/webhook/woocommerce';
    
    try {
      const response = await axios.get(webhookUrl, {
        timeout: 10000,
        validateStatus: (status) => status < 500
      });
      console.log(`✅ Webhook endpoint accessible (Status: ${response.status})`);
    } catch (error) {
      console.error('❌ Webhook endpoint not accessible:', error.message);
      console.log('Make sure your server is running on port 3000');
      return;
    }

    // 2. Test WooCommerce API with current credentials
    console.log('\n2️⃣ Testing WooCommerce API credentials...');
    const connection = await prisma.connection.findFirst({
      where: { platform: 'woocommerce' }
    });

    if (!connection) {
      console.error('❌ No WooCommerce connection found');
      return;
    }

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
      console.log('✅ WooCommerce API credentials work!');
      console.log(`   WooCommerce Version: ${response.data.data?.woocommerce_version || 'Unknown'}`);
    } catch (error) {
      console.error('❌ WooCommerce API credentials failed:', error.response?.data || error.message);
      return;
    }

    // 3. Check existing webhooks
    console.log('\n3️⃣ Checking existing webhooks...');
    try {
      const { data: webhooks } = await client.get('webhooks');
      console.log(`✅ Found ${webhooks.length} existing webhooks`);
      
      const ngrokWebhooks = webhooks.filter(w => 
        w.delivery_url.includes('nonluminous-flawed-lonny.ngrok-free.dev')
      );
      
      if (ngrokWebhooks.length > 0) {
        console.log(`✅ Found ${ngrokWebhooks.length} webhooks pointing to your ngrok URL:`);
        ngrokWebhooks.forEach(webhook => {
          console.log(`   - ${webhook.name} (${webhook.topic}) - Status: ${webhook.status}`);
        });
      } else {
        console.log('⚠️ No webhooks pointing to your ngrok URL found');
        console.log('   Your existing webhooks might be pointing to a different URL');
      }
    } catch (error) {
      console.warn('⚠️ Could not list webhooks:', error.response?.data || error.message);
    }

    // 4. Test webhook processing with simulated WooCommerce order
    console.log('\n4️⃣ Testing webhook processing...');
    const { processStoreToProkip } = require('./src/services/syncService');
    
    const testOrder = {
      id: Date.now(),
      number: Date.now().toString(),
      status: 'completed',
      date_created: new Date().toISOString(),
      total: '150.00',
      line_items: [
        {
          id: 1,
          name: 'Hair cream',
          sku: '4848961',
          quantity: 2,
          price: '75.00',
          total_tax: '7.50'
        },
        {
          id: 2,
          name: 'Claire Wash',
          sku: '4815445',
          quantity: 1,
          price: '60.00',
          total_tax: '6.00'
        }
      ]
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
      
      // Check results
      const salesLog = await prisma.salesLog.findFirst({
        where: { orderId: testOrder.id.toString() }
      });
      
      if (salesLog) {
        console.log(`✅ Sale recorded: Order ${salesLog.orderId}`);
        console.log(`   Stock Deducted: ${salesLog.stockDeducted}`);
        console.log(`   Prokip Sell ID: ${salesLog.prokipSellId || 'Not returned'}`);
      }
      
    } catch (error) {
      console.error('❌ Webhook processing failed:', error.message);
    }

    // 5. Create a test webhook delivery
    console.log('\n5️⃣ Testing webhook delivery from WooCommerce...');
    try {
      // Find a webhook to test
      const { data: webhooks } = await client.get('webhooks');
      const testWebhook = webhooks.find(w => w.topic === 'order.created');
      
      if (testWebhook) {
        console.log(`   Testing webhook: ${testWebhook.name} (ID: ${testWebhook.id})`);
        
        // Ping the webhook
        await client.post(`webhooks/${testWebhook.id}/deliveries`);
        console.log('✅ Webhook ping sent - check your server logs!');
        
        console.log('\n📋 CHECK YOUR SERVER LOGS:');
        console.log('You should see webhook processing logs within 30 seconds');
        console.log('If you see logs, the webhook delivery is working!');
        
      } else {
        console.log('⚠️ No order.created webhook found to test');
      }
    } catch (error) {
      console.warn('⚠️ Could not test webhook delivery:', error.response?.data || error.message);
    }

    console.log('\n✅ Ngrok webhook connection test completed!');
    console.log('\n🎯 FINAL TEST:');
    console.log('1. Create a new "completed" order in WooCommerce');
    console.log('2. Watch your server logs for webhook processing');
    console.log('3. Check Prokip stock levels after the order');
    console.log('4. Verify the stock reduction worked');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run test
testNgrokWebhookConnection();
