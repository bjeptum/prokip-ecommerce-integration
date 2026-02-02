const express = require('express');
const crypto = require('crypto');
const WooToProkipUserService = require('../services/wooToProkipUserService');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const wooService = new WooToProkipUserService();
const prisma = new PrismaClient();

/**
 * WooCommerce Webhook Handler for Per-User Integration
 * This endpoint handles WooCommerce webhooks and routes them to the correct user
 */

/**
 * POST /webhooks/woocommerce/order-created
 * Handle WooCommerce order created webhook
 */
router.post('/order-created', async (req, res) => {
  const startTime = Date.now();
  let userId = null;
  let connectionId = null;

  try {
    console.log('🪝 Received WooCommerce order-created webhook');

    // Verify webhook signature if secret is configured
    const signature = req.headers['x-wc-webhook-signature'];
    const webhookSecret = process.env.WOOCOMMERCE_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      const body = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('base64');

      if (signature !== expectedSignature) {
        console.error('❌ Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const wooOrder = req.body;

    if (!wooOrder.id) {
      throw new Error('Invalid WooCommerce order data: missing order ID');
    }

    // Extract user ID from webhook or order data
    // This depends on your WooCommerce setup - you might need to:
    // 1. Use custom meta fields in WooCommerce orders
    // 2. Use the store domain to identify the user
    // 3. Use a custom header in the webhook
    userId = await extractUserIdFromWebhook(req, wooOrder);

    if (!userId) {
      throw new Error('Unable to determine user ID from webhook');
    }

    console.log(`👤 Processing order ${wooOrder.id} for user ${userId}`);

    // Get user's connection for logging
    const connection = await prisma.prokipConnection.findFirst({
      where: {
        userId: userId,
        isActive: true
      }
    });

    if (!connection) {
      throw new Error(`No active Prokip connection found for user ${userId}`);
    }

    connectionId = connection.id;

    // Process the order using user's authentication
    const result = await wooService.processOrderForUser(userId, wooOrder);

    const processingTime = Date.now() - startTime;
    console.log(`✅ Webhook processed in ${processingTime}ms`);

    res.status(200).json({
      success: true,
      message: 'Order processed successfully',
      transactionId: result.transactionId,
      processingTime
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ Webhook processing failed (${processingTime}ms):`, error.message);

    // Log webhook failure
    if (userId && connectionId) {
      try {
        await wooService.logWebhook(
          userId,
          connectionId,
          'order.created',
          req.body?.id?.toString(),
          req.body,
          false,
          error.message
        );
      } catch (logError) {
        console.error('Failed to log webhook failure:', logError.message);
      }
    }

    // Return appropriate error response
    let statusCode = 500;
    let errorType = 'INTERNAL_ERROR';

    if (error.message.includes('No active Prokip connection')) {
      statusCode = 401;
      errorType = 'NO_CONNECTION';
    } else if (error.message.includes('Unable to determine user ID')) {
      statusCode = 400;
      errorType = 'INVALID_USER';
    } else if (error.message.includes('Insufficient stock')) {
      statusCode = 400;
      errorType = 'INSUFFICIENT_STOCK';
    } else if (error.message.includes('Authentication expired')) {
      statusCode = 401;
      errorType = 'AUTH_EXPIRED';
    }

    res.status(statusCode).json({
      success: false,
      message: error.message,
      error: errorType,
      processingTime
    });
  }
});

/**
 * POST /webhooks/woocommerce/order-updated
 * Handle WooCommerce order updated webhook
 */
router.post('/order-updated', async (req, res) => {
  const startTime = Date.now();
  let userId = null;
  let connectionId = null;

  try {
    console.log('🪝 Received WooCommerce order-updated webhook');

    // Verify webhook signature
    const signature = req.headers['x-wc-webhook-signature'];
    const webhookSecret = process.env.WOOCOMMERCE_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      const body = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('base64');

      if (signature !== expectedSignature) {
        console.error('❌ Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const wooOrder = req.body;

    if (!wooOrder.id) {
      throw new Error('Invalid WooCommerce order data: missing order ID');
    }

    userId = await extractUserIdFromWebhook(req, wooOrder);

    if (!userId) {
      throw new Error('Unable to determine user ID from webhook');
    }

    // Get user's connection
    const connection = await prisma.prokipConnection.findFirst({
      where: {
        userId: userId,
        isActive: true
      }
    });

    if (!connection) {
      throw new Error(`No active Prokip connection found for user ${userId}`);
    }

    connectionId = connection.id;

    // For order updates, we might want to:
    // 1. Check if this is a status change that affects stock
    // 2. Handle refunds or cancellations
    // 3. Update order information in Prokip

    console.log(`📝 Processing order update ${wooOrder.id} for user ${userId}`);

    // Log the webhook
    await wooService.logWebhook(
      userId,
      connectionId,
      'order.updated',
      wooOrder.id.toString(),
      wooOrder,
      true
    );

    const processingTime = Date.now() - startTime;

    res.status(200).json({
      success: true,
      message: 'Order update processed successfully',
      processingTime
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ Order update webhook failed (${processingTime}ms):`, error.message);

    // Log webhook failure
    if (userId && connectionId) {
      try {
        await wooService.logWebhook(
          userId,
          connectionId,
          'order.updated',
          req.body?.id?.toString(),
          req.body,
          false,
          error.message
        );
      } catch (logError) {
        console.error('Failed to log webhook failure:', logError.message);
      }
    }

    res.status(500).json({
      success: false,
      message: error.message,
      processingTime
    });
  }
});

/**
 * POST /webhooks/woocommerce/test/:userId
 * Test webhook endpoint for specific user
 */
router.post('/test/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Create test WooCommerce order
    const testOrder = {
      id: Date.now(),
      number: `TEST-${Date.now()}`,
      total: '99.99',
      status: 'processing',
      billing: {
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        phone: '+1234567890',
        address_1: '123 Test Street',
        city: 'Test City',
        state: 'TS',
        postcode: '12345',
        country: 'US'
      },
      shipping: {
        first_name: 'Test',
        last_name: 'User',
        address_1: '123 Test Street',
        city: 'Test City',
        state: 'TS',
        postcode: '12345',
        country: 'US'
      },
      line_items: [
        {
          id: 1,
          product_id: 123,
          variation_id: 456,
          sku: 'TEST-SKU-001',
          name: 'Test Product',
          quantity: 1,
          price: '99.99',
          total: '99.99'
        }
      ]
    };

    console.log(`🧪 Testing webhook for user ${userId}`);

    const result = await wooService.processOrderForUser(userId, testOrder);

    res.json({
      success: true,
      message: 'Test webhook processed successfully',
      data: result
    });

  } catch (error) {
    console.error(`❌ Test webhook failed:`, error.message);

    res.status(400).json({
      success: false,
      message: error.message,
      error: 'TEST_WEBHOOK_FAILED'
    });
  }
});

/**
 * GET /webhooks/woocommerce/status/:userId
 * Get webhook processing status for user
 */
router.get('/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;

    // Get recent webhook logs for user
    const webhooks = await prisma.webhookLog.findMany({
      where: {
        userId: userId
      },
      include: {
        connection: {
          select: {
            connectionName: true,
            prokipEmail: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    // Get webhook statistics
    const [totalWebhooks, successfulWebhooks, failedWebhooks] = await Promise.all([
      prisma.webhookLog.count({ where: { userId } }),
      prisma.webhookLog.count({ where: { userId, success: true } }),
      prisma.webhookLog.count({ where: { userId, success: false } })
    ]);

    const successRate = totalWebhooks > 0 ? (successfulWebhooks / totalWebhooks * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        statistics: {
          total: totalWebhooks,
          successful: successfulWebhooks,
          failed: failedWebhooks,
          successRate: parseFloat(successRate)
        },
        recentWebhooks: webhooks
      }
    });

  } catch (error) {
    console.error('❌ Failed to get webhook status:', error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to get webhook status',
      error: error.message
    });
  }
});

/**
 * Extract user ID from webhook request
 * This function needs to be customized based on your setup
 */
async function extractUserIdFromWebhook(req, wooOrder) {
  try {
    // Method 1: Check for user ID in custom header
    const userIdHeader = req.headers['x-user-id'];
    if (userIdHeader) {
      return userIdHeader;
    }

    // Method 2: Check for user ID in order meta data
    if (wooOrder.meta_data) {
      const userIdMeta = wooOrder.meta_data.find(meta => meta.key === '_user_id' || meta.key === 'user_id');
      if (userIdMeta && userIdMeta.value) {
        return userIdMeta.value.toString();
      }
    }

    // Method 3: Use store domain to identify user
    const storeDomain = req.headers['x-wc-webhook-source'];
    if (storeDomain) {
      // Look up user by store domain
      const userConnection = await prisma.prokipConnection.findFirst({
        where: {
          // You would need to add storeDomain to your ProkipConnection model
          // storeDomain: storeDomain
        }
      });
      
      if (userConnection) {
        return userConnection.userId;
      }
    }

    // Method 4: Use WooCommerce store URL from order data
    if (wooOrder.store_url) {
      const userConnection = await prisma.prokipConnection.findFirst({
        where: {
          // You would need to add storeUrl to your ProkipConnection model
          // storeUrl: wooOrder.store_url
        }
      });
      
      if (userConnection) {
        return userConnection.userId;
      }
    }

    // Method 5: Default to a test user (for development only)
    if (process.env.NODE_ENV === 'development') {
      return process.env.TEST_USER_ID || 'test-user-1';
    }

    return null;

  } catch (error) {
    console.error('❌ Error extracting user ID from webhook:', error.message);
    return null;
  }
}

/**
 * Middleware to validate webhook request
 */
function validateWebhook(req, res, next) {
  const contentType = req.headers['content-type'];
  
  if (!contentType || !contentType.includes('application/json')) {
    return res.status(400).json({
      error: 'Invalid content type. Expected application/json'
    });
  }

  next();
}

// Apply validation middleware to all webhook routes
router.use(validateWebhook);

module.exports = router;
