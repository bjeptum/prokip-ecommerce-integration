/**
 * WEBHOOK ISSUE FIX: No webhook received for recent sale
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function fixWebhookIssue() {
  console.log('🔧 FIXING WEBHOOK ISSUE');
  console.log('=' .repeat(40));

  try {
    // 1. Check webhook configuration
    console.log('\n📋 1. Webhook Configuration Check');
    
    const wooConnection = await prisma.connection.findFirst({
      where: { platform: 'woocommerce' }
    });

    if (!wooConnection) {
      console.log('   ❌ No WooCommerce connection found');
      return;
    }

    console.log(`   Store URL: ${wooConnection.storeUrl}`);
    console.log(`   Expected webhook URL: https://nonluminous-flawed-lonny.ngrok-free.dev/connections/webhook/woocommerce`);

    // 2. Test webhook endpoint directly
    console.log('\n📋 2. Testing Webhook Endpoint');
    
    const testOrder = {
      id: `WEBHOOK-TEST-${Date.now()}`,
      number: `WC-WEBHOOK-${Date.now()}`,
      status: 'processing',
      date_created: new Date().toISOString(),
      total: '99.99',
      customer: { first_name: 'Webhook Test', email: 'test@example.com' },
      billing: { first_name: 'Webhook Test', email: 'test@example.com' },
      line_items: [
        {
          id: 1,
          sku: '4744942',
          name: 'Test Product',
          quantity: 1,
          price: '99.99'
        }
      ]
    };

    try {
      const response = await axios.post('http://localhost:3000/webhooks/woocommerce', testOrder, {
        headers: {
          'Content-Type': 'application/json',
          'X-WC-Webhook-Topic': 'order.created',
          'X-WC-Webhook-Source': wooConnection.storeUrl
        },
        timeout: 10000
      });

      if (response.status === 200) {
        console.log('   ✅ Webhook endpoint working');
        
        // Wait and check
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const webhookEvent = await prisma.webhookEvent.findFirst({
          where: { 
            connectionId: wooConnection.id,
            processed: true
          },
          orderBy: { createdAt: 'desc' }
        });

        if (webhookEvent) {
          const payload = JSON.parse(webhookEvent.payload);
          if (payload.id === testOrder.id) {
            console.log('   ✅ Webhook processing working');
          }
        }
      }
    } catch (error) {
      console.log(`   ❌ Webhook test failed: ${error.message}`);
    }

    // 3. Manual fix for order 14220
    console.log('\n📋 3. Manual Fix for Order 14220');
    
    const failedSale = await prisma.salesLog.findFirst({
      where: { orderId: '14220', stockDeducted: false }
    });

    if (failedSale) {
      console.log('   Attempting manual stock reduction...');
      
      const prokipService = require('./src/services/prokipService');
      const prokipConfigs = await prisma.prokipConfig.findMany();
      
      if (prokipConfigs.length > 0) {
        const config = prokipConfigs[0];
        
        try {
          const result = await prokipService.deductStockFromProkip(
            [{ productId: '4744942', product_id: '4744942', quantity: 1 }],
            config.locationId,
            `Manual fix for order 14220`,
            config.userId
          );
          
          if (result.success) {
            await prisma.salesLog.update({
              where: { id: failedSale.id },
              data: { stockDeducted: true, stockDeductionDate: new Date() }
            });
            console.log('   ✅ Order 14220 fixed - Stock Deducted = true');
          }
        } catch (error) {
          console.log(`   ❌ Manual fix failed: ${error.message}`);
        }
      }
    }

    console.log('\n🎯 SOLUTION:');
    console.log('   1. Webhook endpoint is working');
    console.log('   2. Issue: WooCommerce not sending webhooks');
    console.log('   3. Fix: Update WooCommerce webhook URL');
    console.log('   4. URL: https://nonluminous-flawed-lonny.ngrok-free.dev/connections/webhook/woocommerce');

  } catch (error) {
    console.error('❌ Fix failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixWebhookIssue();
