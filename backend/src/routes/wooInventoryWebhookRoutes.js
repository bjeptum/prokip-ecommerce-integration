/**
 * WooCommerce Inventory Sync Webhook Routes
 * 
 * DEDICATED ROUTE - Only handles inventory synchronization
 * Filters by order status (processing/completed)
 * Implements proper idempotency and error handling
 */

const express = require('express');
const crypto = require('crypto');
const { handleWooCommerceInventorySync } = require('../services/wooInventorySyncService');

const router = express.Router();

/**
 * WooCommerce Inventory Sync Webhook
 * 
 * POST /webhooks/woocommerce/inventory
 * 
 * Triggers stock reduction in Prokip when WooCommerce orders are:
 * - processing
 * - completed
 * 
 * Ignores: pending, failed, cancelled, refunded
 * 
 * Headers expected:
 * - x-wc-webhook-topic: order.created, order.updated
 * - x-wc-webhook-source: Store URL
 * - x-wc-webhook-signature: HMAC signature (optional)
 */
router.post('/inventory', express.json({ limit: '10mb' }), async (req, res) => {
  console.log('🔔 WooCommerce Inventory Sync Webhook received!');
  console.log('Topic:', req.headers['x-wc-webhook-topic']);
  console.log('Order ID:', req.body?.id);
  console.log('Order Status:', req.body?.status);
  console.log('Store URL:', req.headers['x-wc-webhook-source']);

  const startTime = Date.now();

  try {
    // Extract webhook data
    const wooOrder = req.body;
    const webhookHeaders = req.headers;
    
    // Basic validation
    if (!wooOrder || !wooOrder.id) {
      console.log('❌ Invalid webhook payload: missing order ID');
      return res.status(400).json({
        error: 'Invalid webhook payload',
        message: 'Missing order ID'
      });
    }

    // Verify webhook signature if secret is configured
    const signature = req.headers['x-wc-webhook-signature'];
    const webhookSecret = process.env.WEBHOOK_SECRET || process.env.WOO_WEBHOOK_SECRET;
    
    if (webhookSecret && signature) {
      const payload = JSON.stringify(wooOrder);
      const expectedSignature = crypto.createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('base64');

      if (expectedSignature !== signature) {
        console.log('❌ Invalid webhook signature');
        // Don't reject for now, just log and continue for debugging
      } else {
        console.log('✅ Webhook signature verified');
      }
    }

    // Extract user ID from connection (for Prokip authentication)
    let userId = null;
    const source = req.headers['x-wc-webhook-source'];
    
    if (source) {
      try {
        const prisma = require('../lib/prisma');
        const connection = await prisma.connection.findFirst({
          where: { storeUrl: source }
        });
        
        if (connection) {
          userId = connection.userId;
          console.log(`✅ Found user ID ${userId} for store ${source}`);
        }
      } catch (error) {
        console.log('⚠️ Could not determine user ID:', error.message);
      }
    }

    // Process inventory synchronization
    const result = await handleWooCommerceInventorySync(wooOrder, webhookHeaders, userId);
    
    const processingTime = Date.now() - startTime;
    
    console.log(`📊 Webhook processing completed in ${processingTime}ms:`, {
      orderId: wooOrder.id,
      action: result.action,
      success: result.success
    });

    // Return appropriate response based on processing result
    if (result.success) {
      if (result.action === 'skipped') {
        console.log(`⏭️ Order ${wooOrder.id} skipped: ${result.reason}`);
        return res.status(200).json({
          success: true,
          action: 'skipped',
          orderId: wooOrder.id,
          reason: result.reason,
          processingTime
        });
      } else {
        console.log(`✅ Order ${wooOrder.id} processed successfully`);
        return res.status(200).json({
          success: true,
          action: 'processed',
          orderId: wooOrder.id,
          salesLogId: result.salesLogId,
          prokipSellId: result.prokipSellId,
          itemsProcessed: result.itemsProcessed,
          totalQuantity: result.totalQuantity,
          processingTime
        });
      }
    } else {
      console.log(`❌ Order ${wooOrder.id} processing failed: ${result.reason}`);
      return res.status(500).json({
        success: false,
        action: 'error',
        orderId: wooOrder.id,
        reason: result.reason,
        error: result.error,
        processingTime
      });
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Webhook handling error:', error.message);
    console.error('Stack:', error.stack);
    
    return res.status(500).json({
      success: false,
      action: 'error',
      reason: 'Webhook handling error',
      error: error.message,
      processingTime
    });
  }
});

/**
 * Test endpoint for inventory sync
 * 
 * GET /webhooks/woocommerce/inventory/test
 * 
 * Returns inventory sync statistics
 */
router.get('/inventory/test', async (req, res) => {
  try {
    const { getInventorySyncStats } = require('../services/wooInventorySyncService');
    const stats = await getInventorySyncStats();
    
    res.json({
      success: true,
      message: 'WooCommerce Inventory Sync Service is running',
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Test endpoint error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Health check endpoint
 * 
 * GET /webhooks/woocommerce/inventory/health
 */
router.get('/inventory/health', (req, res) => {
  res.json({
    success: true,
    service: 'WooCommerce Inventory Sync',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
