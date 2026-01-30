/**
 * TEST UPDATED WEBHOOK: Verify automatic stock reduction works
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testUpdatedWebhook() {
  console.log('🧪 TESTING UPDATED WEBHOOK CONFIGURATION');
  console.log('=' .repeat(60));

  try {
    // 1. Get WooCommerce connection
    console.log('\n📋 1. WooCommerce Connection Check');
    
    const wooConnection = await prisma.connection.findFirst({
      where: { platform: 'woocommerce' }
    });

    if (!wooConnection) {
      console.log('   ❌ No WooCommerce connection found');
      return;
    }

    console.log(`   Store URL: ${wooConnection.storeUrl}`);
    console.log(`   Connection ID: ${wooConnection.id}`);

    // 2. Get real product from Prokip
    console.log('\n📋 2. Get Real Product for Testing');
    
    const prokipService = require('./src/services/prokipService');
    const prokipConfigs = await prisma.prokipConfig.findMany();
    
    if (prokipConfigs.length === 0) {
      console.log('   ❌ No Prokip configurations found');
      return;
    }

    const config = prokipConfigs[0];
    const products = await prokipService.getProducts(config.locationId, config.userId);
    
    if (products.length === 0) {
      console.log('   ❌ No products found in Prokip');
      return;
    }

    const realProduct = products[0];
    console.log(`   Test Product: ${realProduct.name}`);
    console.log(`   SKU: ${realProduct.sku}`);
    console.log(`   Current Stock: ${realProduct.stock || realProduct.qty_available || 'N/A'}`);

    // 3. Test Order Created webhook
    console.log('\n📋 3. Testing Order Created Webhook');
    
    const testOrderCreated = {
      id: `WEBHOOK-TEST-CREATED-${Date.now()}`,
      number: `WC-CREATED-${Date.now()}`,
      status: 'processing',
      date_created: new Date().toISOString(),
      total: (parseFloat(realProduct.selling_price || '99.99') * 2).toString(),
      customer: {
        first_name: 'Webhook Test',
        last_name: 'Order Created',
        email: 'test-created@example.com'
      },
      billing: {
        first_name: 'Webhook Test',
        last_name: 'Order Created',
        email: 'test-created@example.com'
      },
      line_items: [
        {
          id: 1,
          sku: realProduct.sku,
          name: realProduct.name,
          quantity: 2,
          price: realProduct.selling_price || '99.99'
        }
      ]
    };

    console.log(`   Sending Order Created webhook: ${testOrderCreated.id}`);
    console.log(`   SKU: ${realProduct.sku}, Quantity: 2`);

    try {
      const createdResponse = await axios.post('http://localhost:3000/webhooks/woocommerce', testOrderCreated, {
        headers: {
          'Content-Type': 'application/json',
          'X-WC-Webhook-Topic': 'order.created',
          'X-WC-Webhook-Source': wooConnection.storeUrl
        },
        timeout: 15000
      });

      if (createdResponse.status === 200) {
        console.log('   ✅ Order Created webhook sent successfully');
      }
    } catch (error) {
      console.log(`   ❌ Order Created webhook failed: ${error.message}`);
      return;
    }

    // 4. Wait for processing
    console.log('\n📋 4. Waiting for Automatic Processing');
    console.log('   ⏳ Waiting 10 seconds for webhook processing...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 5. Check Order Created results
    console.log('\n📋 5. Checking Order Created Results');
    
    const createdWebhookEvent = await prisma.webhookEvent.findFirst({
      where: { 
        connectionId: wooConnection.id,
        processed: true
      },
      orderBy: { createdAt: 'desc' }
    });

    let createdSuccess = false;

    if (createdWebhookEvent) {
      const payload = JSON.parse(createdWebhookEvent.payload);
      if (payload.id === testOrderCreated.id) {
        console.log('   ✅ Order Created webhook processed');
        
        const createdSalesLog = await prisma.salesLog.findFirst({
          where: { 
            connectionId: wooConnection.id,
            orderId: testOrderCreated.id.toString()
          }
        });

        if (createdSalesLog) {
          console.log('   ✅ Sales log created for Order Created');
          console.log(`   Stock Deducted: ${createdSalesLog.stockDeducted ? '✅ YES' : '❌ NO'}`);
          
          if (createdSalesLog.stockDeducted) {
            createdSuccess = true;
            console.log('   🎉 Order Created automatic stock reduction SUCCESSFUL!');
          } else {
            console.log('   ❌ Order Created automatic stock reduction failed');
          }
        }
      }
    }

    // 6. Test Order Updated webhook
    console.log('\n📋 6. Testing Order Updated Webhook');
    
    const testOrderUpdated = {
      ...testOrderCreated,
      id: `WEBHOOK-TEST-UPDATED-${Date.now()}`,
      number: `WC-UPDATED-${Date.now()}`,
      status: 'completed', // Changed to completed
      line_items: [
        {
          id: 1,
          sku: realProduct.sku,
          name: realProduct.name,
          quantity: 1, // Different quantity
          price: realProduct.selling_price || '99.99'
        }
      ]
    };

    console.log(`   Sending Order Updated webhook: ${testOrderUpdated.id}`);
    console.log(`   Status: completed, Quantity: 1`);

    try {
      const updatedResponse = await axios.post('http://localhost:3000/webhooks/woocommerce', testOrderUpdated, {
        headers: {
          'Content-Type': 'application/json',
          'X-WC-Webhook-Topic': 'order.updated',
          'X-WC-Webhook-Source': wooConnection.storeUrl
        },
        timeout: 15000
      });

      if (updatedResponse.status === 200) {
        console.log('   ✅ Order Updated webhook sent successfully');
      }
    } catch (error) {
      console.log(`   ❌ Order Updated webhook failed: ${error.message}`);
    }

    // 7. Wait for Order Updated processing
    console.log('\n📋 7. Waiting for Order Updated Processing');
    console.log('   ⏳ Waiting 10 seconds for webhook processing...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 8. Check Order Updated results
    console.log('\n📋 8. Checking Order Updated Results');
    
    const updatedWebhookEvent = await prisma.webhookEvent.findFirst({
      where: { 
        connectionId: wooConnection.id,
        processed: true
      },
      orderBy: { createdAt: 'desc' }
    });

    let updatedSuccess = false;

    if (updatedWebhookEvent) {
      const payload = JSON.parse(updatedWebhookEvent.payload);
      if (payload.id === testOrderUpdated.id) {
        console.log('   ✅ Order Updated webhook processed');
        
        const updatedSalesLog = await prisma.salesLog.findFirst({
          where: { 
            connectionId: wooConnection.id,
            orderId: testOrderUpdated.id.toString()
          }
        });

        if (updatedSalesLog) {
          console.log('   ✅ Sales log created for Order Updated');
          console.log(`   Stock Deducted: ${updatedSalesLog.stockDeducted ? '✅ YES' : '❌ NO'}`);
          
          if (updatedSalesLog.stockDeducted) {
            updatedSuccess = true;
            console.log('   🎉 Order Updated automatic stock reduction SUCCESSFUL!');
          } else {
            console.log('   ❌ Order Updated automatic stock reduction failed');
          }
        }
      }
    }

    // 9. Final verification
    console.log('\n📋 9. Final Verification');
    
    const recentSalesLogs = await prisma.salesLog.findMany({
      orderBy: { syncedAt: 'desc' },
      take: 5
    });

    console.log('   Recent sales logs:');
    recentSalesLogs.forEach(log => {
      console.log(`   Order ${log.orderId}: Stock Deducted = ${log.stockDeducted ? '✅' : '❌'}`);
    });

    const automaticCount = recentSalesLogs.filter(log => log.stockDeducted).length;
    console.log(`   Automatic success rate: ${automaticCount}/${recentSalesLogs.length}`);

    console.log('\n🎯 WEBHOOK TEST RESULTS:');
    console.log(`   Order Created webhook: ${createdSuccess ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`   Order Updated webhook: ${updatedSuccess ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`   Overall automatic sync: ${createdSuccess && updatedSuccess ? '✅ PERFECT' : '❌ NEEDS ATTENTION'}`);

    if (createdSuccess && updatedSuccess) {
      console.log('\n🎉 WEBHOOK CONFIGURATION PERFECT!');
      console.log('   ✅ Order Created webhook working');
      console.log('   ✅ Order Updated webhook working');
      console.log('   ✅ Automatic stock reduction working');
      console.log('   ✅ Real-time sync with Prokip');
      console.log('\n🚀 READY FOR PRODUCTION:');
      console.log('   Your WooCommerce sales will automatically reduce Prokip stock!');
    } else {
      console.log('\n❌ WEBHOOK ISSUES DETECTED:');
      if (!createdSuccess) console.log('   - Order Created webhook not working');
      if (!updatedSuccess) console.log('   - Order Updated webhook not working');
      console.log('   💡 Check webhook processing logic');
    }

  } catch (error) {
    console.error('\n❌ Webhook test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the webhook test
if (require.main === module) {
  testUpdatedWebhook()
    .then(() => {
      console.log('\n✨ Webhook test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test crashed:', error);
      process.exit(1);
    });
}

module.exports = { testUpdatedWebhook };
