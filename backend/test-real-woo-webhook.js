const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testRealWooCommerceWebhook() {
  console.log('🧪 Testing Real WooCommerce Webhook');
  console.log('===================================');

  try {
    // 1. Get connection
    console.log('\n1️⃣ Getting WooCommerce connection...');
    const connection = await prisma.connection.findFirst({
      where: { platform: 'woocommerce' }
    });

    if (!connection) {
      console.error('❌ No WooCommerce connection found');
      return;
    }

    console.log(`✅ Store: ${connection.storeUrl}`);

    // 2. Test webhook processing with real store data
    console.log('\n2️⃣ Testing webhook processing...');
    const { processStoreToProkip } = require('./src/services/syncService');
    
    // Create a realistic test order
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
      
      // Check inventory changes
      console.log('\n3️⃣ Checking inventory changes...');
      for (const item of testOrder.line_items) {
        if (item.sku) {
          const inventoryLog = await prisma.inventoryLog.findFirst({
            where: { sku: item.sku }
          });

          if (inventoryLog) {
            console.log(`   SKU ${item.sku}: ${inventoryLog.quantity} units`);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Webhook processing failed:', error.message);
      return;
    }

    // 4. Test webhook delivery from WooCommerce
    console.log('\n4️⃣ Testing webhook delivery...');
    const wooBaseUrl = 'https://learn.prokip.africa/wp-json/wc/v3/';
    const consumerKey = 'ck_9dd6b146b7abfd64660215805e0913446cd41597';
    const consumerSecret = 'cs_d8e1b8c2cd2c5e5aee3f943971f9e379449baa1e';
    
    const client = axios.create({
      baseURL: wooBaseUrl,
      auth: {
        username: consumerKey,
        password: consumerSecret
      },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Prokip-Integration/1.0'
      },
      timeout: 15000
    });

    try {
      // Find and ping webhooks
      const { data: webhooks } = await client.get('webhooks');
      const orderWebhook = webhooks.find(w => w.topic === 'order.created');
      
      if (orderWebhook) {
        console.log(`   Found webhook: ${orderWebhook.name} (ID: ${orderWebhook.id})`);
        console.log(`   Delivery URL: ${orderWebhook.delivery_url}`);
        
        // Ping the webhook
        await client.post(`webhooks/${orderWebhook.id}/deliveries`);
        console.log('✅ Webhook ping sent - check your server logs!');
        
        // Wait a moment and check for recent deliveries
        setTimeout(async () => {
          try {
            const { data: deliveries } = await client.get(`webhooks/${orderWebhook.id}/deliveries`);
            const recentDelivery = deliveries[0];
            
            if (recentDelivery) {
              console.log(`\n📊 Recent webhook delivery:`);
              console.log(`   Status: ${recentDelivery.status}`);
              console.log(`   Duration: ${recentDelivery.duration}ms`);
              console.log(`   Summary: ${recentDelivery.summary}`);
              console.log(`   Created: ${recentDelivery.created_at}`);
              
              if (recentDelivery.status === 'success') {
                console.log('✅ Webhook delivery successful!');
              } else {
                console.log('❌ Webhook delivery failed');
                console.log(`   Error: ${recentDelivery.response?.body || 'Unknown error'}`);
              }
            }
          } catch (error) {
            console.warn('⚠️ Could not check webhook deliveries:', error.message);
          }
        }, 3000);
        
      } else {
        console.log('⚠️ No order.created webhook found');
      }
    } catch (error) {
      console.warn('⚠️ Could not test webhook delivery:', error.response?.data || error.message);
    }

    console.log('\n✅ Test completed!');
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Create a real "completed" order in WooCommerce');
    console.log('2. Watch your server console for webhook processing logs');
    console.log('3. Check Prokip stock levels after the order');
    console.log('4. Verify the stock reduction worked');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run test
testRealWooCommerceWebhook();
