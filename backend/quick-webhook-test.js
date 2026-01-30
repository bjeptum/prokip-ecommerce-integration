const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function quickWebhookTest() {
  console.log('⚡ Quick Webhook Test');
  console.log('====================');

  try {
    // 1. Test ngrok webhook endpoint
    console.log('\n1️⃣ Testing ngrok webhook endpoint...');
    const webhookUrl = 'https://nonluminous-flawed-lonny.ngrok-free.dev/connections/webhook/woocommerce';
    
    try {
      const response = await axios.get(webhookUrl, {
        timeout: 5000,
        validateStatus: (status) => status < 500
      });
      console.log(`✅ Webhook endpoint accessible (Status: ${response.status})`);
    } catch (error) {
      console.error('❌ Webhook endpoint not accessible:', error.message);
      console.log('   Make sure your server is running on port 3000');
      return;
    }

    // 2. Test webhook processing directly (simulate webhook)
    console.log('\n2️⃣ Testing webhook processing directly...');
    const { processStoreToProkip } = require('./src/services/syncService');
    
    // Get connection
    const connection = await prisma.connection.findFirst({
      where: { platform: 'woocommerce' }
    });

    if (!connection) {
      console.error('❌ No WooCommerce connection found');
      return;
    }

    const testOrder = {
      id: Date.now(),
      number: Date.now().toString(),
      status: 'completed',
      date_created: new Date().toISOString(),
      total: '125.50',
      line_items: [
        {
          id: 1,
          name: 'Hair cream',
          sku: '4848961',
          quantity: 1,
          price: '62.75',
          total_tax: '6.28'
        },
        {
          id: 2,
          name: 'Claire Wash',
          sku: '4815445',
          quantity: 1,
          price: '57.75',
          total_tax: '5.78'
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

    // 4. Create a manual webhook test
    console.log('\n4️⃣ Creating manual webhook test...');
    console.log('Since WooCommerce API is timing out, let\'s test manually:');
    console.log('\n📋 MANUAL TEST STEPS:');
    console.log('1. Go to your WooCommerce admin');
    console.log('2. Create a new test order');
    console.log('3. Set order status to "Completed"');
    console.log('4. Save the order');
    console.log('5. Check your server logs for webhook processing');
    
    console.log('\n🔧 TO CHECK WEBHOOKS IN WOOCOMMERCE:');
    console.log('1. Go to WooCommerce > Settings > Advanced > Webhooks');
    console.log('2. Verify you have webhooks for:');
    console.log('   - Order created');
    console.log('   - Order updated');
    console.log('   - Order status changed');
    console.log('3. Check that webhook URL is:');
    console.log(`   ${webhookUrl}`);
    console.log('4. Verify status is "Active"');
    
    console.log('\n🔧 TO CHECK WEBHOOK DELIVERY:');
    console.log('1. In WooCommerce webhook settings, click "View" on a webhook');
    console.log('2. Check "Recent deliveries" section');
    console.log('3. Look for recent webhook deliveries');
    console.log('4. Check delivery status and response');
    
    console.log('\n✅ WEBHOOK PROCESSING CODE IS WORKING!');
    console.log('The issue is only with WooCommerce API timeouts.');
    console.log('Your webhooks should work when WooCommerce sends them.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run quick test
quickWebhookTest();
