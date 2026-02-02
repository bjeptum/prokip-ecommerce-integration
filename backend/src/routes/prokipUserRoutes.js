const express = require('express');
const { body, validationResult } = require('express-validator');
const ProkipUserAuthService = require('../services/prokipUserAuthService');
const WooToProkipUserService = require('../services/wooToProkipUserService');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const authService = new ProkipUserAuthService();
const wooService = new WooToProkipUserService();
const prisma = new PrismaClient();

/**
 * POST /api/prokip/auth/connect
 * Connect user's Prokip account
 */
router.post('/auth/connect', async (req, res) => {
  try {
    const { userId, email, password, connectionName } = req.body;

    // Basic validation
    if (!userId || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'User ID, email, and password are required'
      });
    }

    if (!email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required'
      });
    }

    // Authenticate user with Prokip
    const result = await authService.authenticateUser(userId, email, password, connectionName);

    res.json({
      success: true,
      message: 'Prokip account connected successfully',
      data: result
    });

  } catch (error) {
    console.error('❌ Failed to connect Prokip account:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to connect Prokip account',
      error: error.message
    });
  }
});

/**
 * GET /api/prokip/auth/status/:userId
 * Get user's Prokip connection status
 */
router.get('/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const connection = await authService.getUserConnection(userId);

    if (!connection) {
      return res.json({
        success: true,
        connected: false,
        message: 'No Prokip connection found'
      });
    }

    // Check if token is expired
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + (5 * 60 * 1000));
    const needsReauth = connection.tokenExpiresAt <= fiveMinutesFromNow;

    res.json({
      success: true,
      connected: true,
      needsReauth: needsReauth,
      connection: {
        id: connection.id,
        connectionName: connection.connectionName,
        prokipEmail: connection.prokipEmail,
        lastSyncAt: connection.lastSyncAt,
        tokenExpiresAt: connection.tokenExpiresAt
      }
    });

  } catch (error) {
    console.error('❌ Failed to get connection status:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get connection status',
      error: error.message
    });
  }
});

/**
 * POST /api/prokip/auth/disconnect/:userId
 * Disconnect user's Prokip account
 */
router.post('/disconnect/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await authService.disconnectUser(userId);

    res.json({
      success: true,
      message: 'Prokip account disconnected successfully',
      disconnected: result
    });

  } catch (error) {
    console.error('❌ Failed to disconnect Prokip account:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect Prokip account',
      error: error.message
    });
  }
});

/**
 * POST /api/prokip/auth/refresh/:userId
 * Force re-authentication for user
 */
router.post('/refresh/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const reauthInfo = await authService.requireReauthentication(userId);

    res.json({
      success: true,
      message: 'Re-authentication required',
      data: reauthInfo
    });

  } catch (error) {
    console.error('❌ Failed to require re-authentication:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to process re-authentication',
      error: error.message
    });
  }
});

/**
 * POST /api/prokip/test-stock/:userId
 * Test stock availability for user
 */
router.post('/test-stock/:userId', [
  body('items').isArray().withMessage('Items array is required'),
  body('items.*.sku').notEmpty().withMessage('SKU is required for each item'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { userId } = req.params;
    const { items } = req.body;

    const stockCheck = await authService.checkStockAvailability(userId, items);

    res.json({
      success: true,
      data: stockCheck
    });

  } catch (error) {
    console.error('❌ Stock check failed:', error.message);
    
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'STOCK_CHECK_FAILED'
    });
  }
});

/**
 * GET /api/prokip/transactions/:userId
 * Get user's transaction history
 */
router.get('/transactions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      page = 1,
      limit = 20,
      status,
      startDate,
      endDate
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      startDate,
      endDate
    };

    const history = await wooService.getUserTransactionHistory(userId, options);

    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error('❌ Failed to get transaction history:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get transaction history',
      error: error.message
    });
  }
});

/**
 * GET /api/prokip/failed-syncs/:userId
 * Get user's failed syncs
 */
router.get('/failed-syncs/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      page = 1,
      limit = 20,
      resolved = false
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      resolved: resolved === 'true'
    };

    const failedSyncs = await wooService.getUserFailedSyncs(userId, options);

    res.json({
      success: true,
      data: failedSyncs
    });

  } catch (error) {
    console.error('❌ Failed to get failed syncs:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get failed syncs',
      error: error.message
    });
  }
});

/**
 * POST /api/prokip/retry/:userId/:transactionId
 * Retry a failed transaction
 */
router.post('/retry/:userId/:transactionId', async (req, res) => {
  try {
    const { userId, transactionId } = req.params;

    const result = await wooService.retryTransaction(userId, transactionId);

    res.json({
      success: true,
      message: 'Transaction retry initiated',
      data: result
    });

  } catch (error) {
    console.error('❌ Failed to retry transaction:', error.message);
    
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'RETRY_FAILED'
    });
  }
});

/**
 * POST /api/prokip/test-order/:userId
 * Test order processing with sample data
 */
router.post('/test-order/:userId', [
  body('orderData').optional().isObject(),
  body('useSample').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { userId } = req.params;
    const { orderData, useSample = true } = req.body;

    let wooOrder;

    if (useSample || !orderData) {
      // Create sample WooCommerce order
      wooOrder = {
        id: Date.now(),
        number: `TEST-${Date.now()}`,
        total: '299.99',
        status: 'processing',
        billing: {
          first_name: 'Test',
          last_name: 'Customer',
          email: 'test@example.com',
          phone: '+1234567890',
          address_1: '123 Test Street',
          city: 'Test City',
          state: 'Test State',
          postcode: '12345',
          country: 'US'
        },
        shipping: {
          first_name: 'Test',
          last_name: 'Customer',
          address_1: '123 Test Street',
          city: 'Test City',
          state: 'Test State',
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
            quantity: 2,
            price: '149.99',
            total: '299.99'
          }
        ]
      };
    } else {
      wooOrder = orderData;
    }

    const result = await wooService.processOrderForUser(userId, wooOrder);

    res.json({
      success: true,
      message: 'Test order processed successfully',
      data: result
    });

  } catch (error) {
    console.error('❌ Test order failed:', error.message);
    
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'TEST_ORDER_FAILED'
    });
  }
});

/**
 * GET /api/prokip/settings/:userId
 * Get user's integration settings
 */
router.get('/settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const settings = await prisma.userIntegrationSettings.findUnique({
      where: { userId }
    });

    if (!settings) {
      // Create default settings
      const defaultSettings = await prisma.userIntegrationSettings.create({
        data: {
          userId
        }
      });

      return res.json({
        success: true,
        data: defaultSettings
      });
    }

    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('❌ Failed to get settings:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get settings',
      error: error.message
    });
  }
});

/**
 * PUT /api/prokip/settings/:userId
 * Update user's integration settings
 */
router.put('/settings/:userId', [
  body('autoSyncEnabled').optional().isBoolean(),
  body('stockCheckEnabled').optional().isBoolean(),
  body('webhookSecret').optional().isString(),
  body('defaultLocationId').optional().isString(),
  body('lowStockThreshold').optional().isInt({ min: 0 }),
  body('enableNotifications').optional().isBoolean(),
  body('notificationEmail').optional().isEmail(),
  body('skuMapping').optional().isObject(),
  body('autoCreateCustomers').optional().isBoolean(),
  body('maxRetries').optional().isInt({ min: 0, max: 10 }),
  body('retryDelaySeconds').optional().isInt({ min: 30 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { userId } = req.params;
    const updateData = req.body;

    const settings = await prisma.userIntegrationSettings.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        ...updateData
      }
    });

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: settings
    });

  } catch (error) {
    console.error('❌ Failed to update settings:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: error.message
    });
  }
});

/**
 * GET /api/prokip/stats/:userId
 * Get user's integration statistics
 */
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const [
      totalTransactions,
      completedTransactions,
      failedTransactions,
      pendingTransactions,
      connection
    ] = await Promise.all([
      prisma.stockTransaction.count({ where: { userId } }),
      prisma.stockTransaction.count({ where: { userId, status: 'completed' } }),
      prisma.stockTransaction.count({ where: { userId, status: 'failed' } }),
      prisma.stockTransaction.count({ where: { userId, status: 'pending' } }),
      authService.getUserConnection(userId)
    ]);

    const successRate = totalTransactions > 0 ? (completedTransactions / totalTransactions * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        connection: {
          connected: !!connection,
          connectionName: connection?.connectionName,
          lastSyncAt: connection?.lastSyncAt
        },
        transactions: {
          total: totalTransactions,
          completed: completedTransactions,
          failed: failedTransactions,
          pending: pendingTransactions,
          successRate: parseFloat(successRate)
        }
      }
    });

  } catch (error) {
    console.error('❌ Failed to get stats:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get statistics',
      error: error.message
    });
  }
});

module.exports = router;
