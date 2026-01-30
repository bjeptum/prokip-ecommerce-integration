/**
 * QUICK FIX: WooCommerce to Prokip Stock Reduction
 * Addresses the core issue: webhooks not being received
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function quickFixStockReduction() {
  console.log('🚀 QUICK FIX: WooCommerce to Prokip Stock Reduction');
  console.log('=' .repeat(60));

  try {
    // Step 1: Check current state
    console.log('\n📋 Step 1: Current System State');
    
    const webhooks = await prisma.webhookEvent.findMany();
    const sales = await prisma.salesLog.findMany({ orderBy: { syncedAt: 'desc' }, take: 5 });
    const errors = await prisma.syncError.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
    const connections = await prisma.connection.findMany({ where: { platform: 'woocommerce' } });
    const prokipConfigs = await prisma.prokipConfig.findMany();
    
    console.log(`   Webhook events: ${webhooks.length}`);
    console.log(`   Sales logs: ${sales.length}`);
    console.log(`   Sync errors: ${errors.length}`);
    console.log(`   WooCommerce connections: ${connections.length}`);
    console.log(`   Prokip configs: ${prokipConfigs.length}`);

    // Step 2: Root Cause Analysis
    console.log('\n🔍 ROOT CAUSE ANALYSIS');
    
    if (webhooks.length === 0) {
      console.log('❌ PRIMARY ISSUE: No webhooks received from WooCommerce');
      console.log('   This means WooCommerce is not sending webhooks to your system');
    }

    // Step 3: Immediate Solutions
    console.log('\n🎯 IMMEDIATE SOLUTIONS');
    
    console.log('\n1. FIX WOOCOMMERCE WEBHOOK CONFIGURATION:');
    console.log('   Log into your WooCommerce admin panel');
    console.log('   Go to: WooCommerce > Settings > Advanced > Webhooks');
    console.log('   Add a new webhook with:');
    console.log('   - Name: Prokip Stock Sync');
    console.log('   - Payload URL: http://localhost:3000/webhooks/woocommerce');
    console.log('   - Action: Order created');
    console.log('   - Status: Processing (or Completed)');
    console.log('   - Secret: any-secret-key (save this in .env as WEBHOOK_SECRET)');
    
    console.log('\n2. TEST WEBHOOK ENDPOINT:');
    console.log('   You can test the webhook with curl:');
    console.log('   curl -X POST http://localhost:3000/webhooks/woocommerce \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"id":"test-123","status":"processing","line_items":[{"sku":"TEST","quantity":1}]}\'');
    
    console.log('\n3. CHECK PROKIP CONFIGURATION:');
    if (prokipConfigs.length === 0) {
      console.log('   ❌ No Prokip configuration found');
      console.log('   You need to configure Prokip credentials in the system');
    } else {
      console.log('   ✅ Prokip configuration found');
      prokipConfigs.forEach(config => {
        console.log(`   - User ${config.userId}: Location ${config.locationId}`);
      });
    }

    // Step 4: Enhanced Webhook Endpoint Code
    console.log('\n📝 ENHANCED WEBHOOK ENDPOINT:');
    console.log('Replace your current webhookRoutes.js with this enhanced version:');
    
    const enhancedWebhookCode = `
// Enhanced WooCommerce Webhook Endpoint
const express = require('express');
const crypto = require('crypto');
const { processStoreToProkip } = require('../services/syncService');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Enhanced WooCommerce webhook endpoint
router.post('/woocommerce', express.json({ limit: '10mb' }), async (req, res) => {
  console.log('🔔 WooCommerce webhook received!');
  console.log('Topic:', req.headers['x-wc-webhook-topic']);
  console.log('Order ID:', req.body?.id);
  console.log('Order Status:', req.body?.status);
  
  try {
    const signature = req.headers['x-wc-webhook-signature'];
    const topic = req.headers['x-wc-webhook-topic'] || 'order.created';
    const source = req.headers['x-wc-webhook-source'];
    
    // Store webhook event for debugging
    await prisma.webhookEvent.create({
      data: {
        connectionId: 1, // Adjust based on your setup
        eventType: topic,
        payload: JSON.stringify(req.body),
        processed: false
      }
    });
    
    console.log('✅ Webhook event stored');
    
    // Find store URL
    let storeUrl = source || req.body.site_url || 'https://learn.prokip.africa/';
    
    // Process webhook asynchronously
    setImmediate(async () => {
      try {
        console.log('🔄 Processing webhook...');
        await processStoreToProkip(storeUrl, topic, req.body, 'woocommerce');
        console.log('✅ Webhook processed successfully');
        
        // Mark as processed
        await prisma.webhookEvent.updateMany({
          where: { processed: false },
          data: { processed: true, processedAt: new Date() }
        });
        
      } catch (error) {
        console.error('❌ Webhook processing failed:', error.message);
      }
    });

    res.status(200).send('OK');
    
  } catch (error) {
    console.error('❌ Webhook error:', error.message);
    res.status(500).send('Error');
  }
});

module.exports = router;
`;

    console.log(enhancedWebhookCode);

    // Step 5: Test with sample data
    console.log('\n🧪 TESTING WITH SAMPLE DATA:');
    
    if (connections.length > 0) {
      const sampleWebhook = {
        id: `sample-${Date.now()}`,
        status: 'processing',
        date_created: new Date().toISOString(),
        total: '99.99',
        line_items: [
          {
            sku: 'SAMPLE-SKU',
            quantity: 2,
            price: '49.99'
          }
        ]
      };
      
      console.log('Sample webhook data:');
      console.log(JSON.stringify(sampleWebhook, null, 2));
      
      // Store sample webhook for testing
      try {
        await prisma.webhookEvent.create({
          data: {
            connectionId: connections[0].id,
            eventType: 'order.created',
            payload: JSON.stringify(sampleWebhook),
            processed: false
          }
        });
        console.log('✅ Sample webhook stored - you can now test processing');
      } catch (error) {
        console.log('⚠️ Could not store sample webhook:', error.message);
      }
    }

    // Step 6: Final Recommendations
    console.log('\n🎯 FINAL RECOMMENDATIONS:');
    console.log('1. Configure WooCommerce webhooks IMMEDIATELY');
    console.log('2. Update webhookRoutes.js with enhanced code');
    console.log('3. Test with curl or sample data');
    console.log('4. Check webhook events table for incoming webhooks');
    console.log('5. Verify sales logs are created after webhook processing');
    console.log('6. Confirm stock reduction in Prokip');
    
    console.log('\n🔧 WHY STOCK IS NOT REDUCING:');
    console.log('- PRIMARY: WooCommerce webhooks are not being sent');
    console.log('- SECONDARY: If webhooks are sent, processing may be failing');
    console.log('- TERTIARY: Prokip API endpoints may need adjustment');
    
    console.log('\n✅ EXPECTED RESULT AFTER FIX:');
    console.log('WooCommerce Sale → Webhook Received → Sale Recorded → Stock Reduced ✅');

  } catch (error) {
    console.error('\n❌ Quick fix failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the quick fix
if (require.main === module) {
  quickFixStockReduction()
    .then(() => {
      console.log('\n✨ Quick fix analysis complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Quick fix crashed:', error);
      process.exit(1);
    });
}

module.exports = { quickFixStockReduction };
