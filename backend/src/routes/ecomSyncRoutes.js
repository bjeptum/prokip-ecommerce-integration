const express = require('express');
const prisma = require('../lib/prisma');
const { testWooConnection } = require('../services/wooService');
const { testShopifyConnection } = require('../services/shopifyService');
const prokipEcomClient = require('../services/prokipEcomClient');

const router = express.Router();

// Custom authentication middleware for sync routes
router.use(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  // Try to verify as JWT first
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.user = decoded;
    return next();
  } catch (jwtError) {
    // If JWT fails, try Prokip token
    try {
      const prokipConfig = await prisma.prokipConfig.findFirst({ where: { token } });
      
      if (prokipConfig) {
        req.userId = prokipConfig.userId;
        req.user = { id: prokipConfig.userId };
        return next();
      } else {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
    } catch (dbError) {
      return res.status(403).json({ error: 'Invalid token' });
    }
  }
});

/**
 * PROKIP E-COMMERCE API ENDPOINTS
 * Proxy to Prokip-2 /api/ecom/* endpoints
 */

/**
 * Connect Store to Prokip
 * POST /api/ecom/connect-store
 */
router.post('/connect-store', async (req, res) => {
  try {
    const { platform, store_url, api_key, api_secret, access_token } = req.body;
    const userId = req.userId;

    if (!platform || !store_url) {
      return res.status(400).json({ 
        success: false, 
        message: 'Platform and store URL are required' 
      });
    }

    if (platform === 'woocommerce' && (!api_key || !api_secret)) {
      return res.status(400).json({ 
        success: false, 
        message: 'API key and secret are required for WooCommerce' 
      });
    }

    if (platform === 'shopify' && !access_token) {
      return res.status(400).json({ 
        success: false, 
        message: 'Access token is required for Shopify' 
      });
    }

    // Validate connection
    let testResult;
    if (platform === 'woocommerce') {
      testResult = await testWooConnection(store_url, api_key, api_secret);
    } else if (platform === 'shopify') {
      testResult = await testShopifyConnection(store_url, access_token);
    }

    if (!testResult?.success) {
      return res.status(400).json({ 
        success: false, 
        message: testResult?.message || 'Store connection test failed' 
      });
    }

    // Store connection locally (for webhooks + internal tracking)
    const connection = await prisma.connection.create({
      data: {
        userId,
        platform,
        storeUrl: store_url,
        accessToken: access_token || null,
        consumerKey: api_key || null,
        consumerSecret: api_secret || null,
        status: 'connected',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Register with Prokip-2 e-commerce API
    let prokipResponse = null;
    try {
      prokipResponse = await prokipEcomClient.connectStore({
        platform,
        store_url,
        api_key,
        api_secret,
        access_token
      }, userId);
    } catch (error) {
      console.error('Prokip-2 connect-store failed:', error.message);
    }

    res.json({
      success: true,
      store_id: prokipResponse?.store_id || connection.id,
      local_store_id: connection.id,
      message: prokipResponse?.message || 'Store connected successfully'
    });
  } catch (error) {
    console.error('Connect store error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to connect store',
      error: error.message 
    });
  }
});

/**
 * Sync Products to Prokip
 * POST /api/ecom/sync-products
 */
router.post('/sync-products', async (req, res) => {
  try {
    const { store_id, limit = 100, page = 1 } = req.body;
    const userId = req.userId;

    if (!store_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Store ID is required' 
      });
    }

    const response = await prokipEcomClient.syncProducts({
      store_id,
      limit,
      page
    }, userId);

    res.json(response);
  } catch (error) {
    console.error('Sync products error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to sync products',
      error: error.message 
    });
  }
});

/**
 * Sync Orders to Prokip (with stock deduction)
 * POST /api/ecom/sync-orders
 */
router.post('/sync-orders', async (req, res) => {
  try {
    const { store_id, status = 'completed', limit = 100, page = 1 } = req.body;
    const userId = req.userId;

    if (!store_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Store ID is required' 
      });
    }

    const response = await prokipEcomClient.syncOrders({
      store_id,
      status,
      limit,
      page
    }, userId);

    res.json(response);
  } catch (error) {
    console.error('Sync orders error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to sync orders',
      error: error.message 
    });
  }
});

/**
 * Get Connected Stores
 * GET /api/ecom/stores
 */
router.get('/stores', async (req, res) => {
  try {
    const userId = req.userId;
    const response = await prokipEcomClient.getStores(userId);
    res.json(response);
  } catch (error) {
    console.error('Get stores error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get stores',
      error: error.message 
    });
  }
});

/**
 * Test Store Connection
 * POST /api/ecom/test-connection
 */
router.post('/test-connection', async (req, res) => {
  try {
    const { store_id } = req.body;
    const userId = req.userId;

    if (!store_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Store ID is required' 
      });
    }

    const response = await prokipEcomClient.testConnection({ store_id }, userId);
    res.json(response);
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to test connection',
      error: error.message 
    });
  }
});

/**
 * Disconnect Store
 * DELETE /api/ecom/disconnect-store/:id
 */
router.delete('/disconnect-store/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const response = await prokipEcomClient.disconnectStore(id, userId);
    res.json(response);
  } catch (error) {
    console.error('Disconnect store error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to disconnect store',
      error: error.message 
    });
  }
});

/**
 * Get Sync Status
 * GET /api/ecom/sync-status/:store_id
 */
router.get('/sync-status/:store_id', async (req, res) => {
  try {
    const { store_id } = req.params;
    const userId = req.userId;
    const response = await prokipEcomClient.getSyncStatus(store_id, userId);
    res.json(response);
  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get sync status',
      error: error.message 
    });
  }
});

// Status endpoint doesn't require auth (public dashboard data)
router.get('/status', async (req, res) => {
  const connections = await prisma.connection.findMany();

  let prokipStats = { products: 0, sales: 0, purchases: 0 };

  try {
    const prokipProducts = await prisma.inventoryLog.groupBy({
      by: ['sku'],
      _count: { sku: true }
    });
    prokipStats.products = prokipProducts.length;

    const salesCount = await prisma.salesLog.count({
      where: { 
        status: {
          in: ['completed', 'paid', 'processing']
        }
      }
    });

    prokipStats.sales = salesCount;
    prokipStats.purchases = 0;
  } catch (error) {
    console.error('Error fetching Prokip stats:', error);
  }

  const connectionsWithStats = await Promise.all(connections.map(async (c) => {
    let productCount = 0;
    let orderCount = 0;

    try {
      productCount = await prisma.inventoryLog.count({
        where: { connectionId: c.id }
      });
    } catch (error) {
      productCount = 0;
    }

    try {
      orderCount = await prisma.salesLog.count({
        where: { connectionId: c.id }
      });
    } catch (error) {
      orderCount = 0;
    }

    return {
      id: c.id,
      platform: c.platform,
      storeUrl: c.storeUrl,
      status: c.status,
      lastSync: c.lastSync,
      productCount,
      orderCount
    };
  }));

  res.json({
    success: true,
    connections: connectionsWithStats,
    prokipStats
  });
});

module.exports = router;
