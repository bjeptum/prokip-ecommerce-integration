const express = require('express');
const authenticateToken = require('../middlewares/authMiddleware');
const { pollProkipToStores } = require('../services/syncService');
const { processStoreToProkip } = require('../services/syncService');
const prisma = require('../lib/prisma');
const { getWooOrders, getWooProducts } = require('../services/wooService');
const { getShopifyOrders, getShopifyProducts } = require('../services/shopifyService');
const { decryptCredentials } = require('../services/storeService');
const prokipService = require('../services/prokipService');

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
 * PROKIP API ENDPOINTS (as per documentation)
 * These follow the Prokip API standards for WordPress plugin integration
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

    // Validate platform-specific credentials
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

    // Test connection first
    let testResult;
    try {
      if (platform === 'woocommerce') {
        const { testWooConnection } = require('../services/wooService');
        testResult = await testWooConnection(store_url, api_key, api_secret);
      } else if (platform === 'shopify') {
        const { testShopifyConnection } = require('../services/shopifyService');
        testResult = await testShopifyConnection(store_url, access_token);
      }
    } catch (error) {
      return res.status(400).json({ 
        success: false, 
        message: `Connection test failed: ${error.message}` 
      });
    }

    if (!testResult.success) {
      return res.status(400).json({ 
        success: false, 
        message: 'Store connection test failed' 
      });
    }

    // Store connection in database
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

    res.json({
      success: true,
      store_id: connection.id,
      message: 'Store connected successfully'
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

    // Get store connection
    const connection = await prisma.connection.findFirst({
      where: { 
        id: parseInt(store_id),
        userId: userId
      }
    });

    if (!connection) {
      return res.status(404).json({ 
        success: false, 
        message: 'Store connection not found' 
      });
    }

    let storeProducts = [];
    
    // Get products from the store
    if (connection.platform === 'shopify') {
      storeProducts = await getShopifyProducts(connection.storeUrl, connection.accessToken);
    } else if (connection.platform === 'woocommerce') {
      storeProducts = await getWooProducts(connection);
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const paginatedProducts = storeProducts.slice(startIndex, startIndex + limit);

    console.log(`📦 Syncing ${paginatedProducts.length} products from ${connection.platform} to Prokip`);
    
    let syncedCount = 0;
    const results = [];
    
    for (const product of paginatedProducts) {
      if (!product.sku) continue;
      
      try {
        // Transform store product to Prokip format
        const prokipProduct = {
          name: product.title || product.name,
          sku: product.sku,
          sellPrice: product.price || 0,
          purchasePrice: 0,
          quantity: product.inventory_quantity || product.stock || 0,
          description: product.description || product.body_html || ''
        };
        
        // Create/update product in Prokip
        await prokipService.createProduct(prokipProduct, userId);
        
        // Log to inventory tracking
        await prisma.inventoryLog.upsert({
          where: {
            connectionId_sku: {
              connectionId: connection.id,
              sku: product.sku
            }
          },
          update: {
            productName: product.title || product.name,
            quantity: product.inventory_quantity || product.stock || 0,
            price: product.price || 0,
            lastSynced: new Date()
          },
          create: {
            connectionId: connection.id,
            productId: product.id?.toString() || product.sku,
            productName: product.title || product.name,
            sku: product.sku,
            quantity: product.inventory_quantity || product.stock || 0,
            price: product.price || 0,
            lastSynced: new Date()
          }
        });
        
        syncedCount++;
        results.push({
          sku: product.sku,
          status: 'success',
          name: product.title || product.name
        });
        
      } catch (error) {
        console.error(`Failed to sync product ${product.sku}:`, error.message);
        results.push({
          sku: product.sku,
          status: 'failed',
          error: error.message
        });
      }
    }

    // Update last sync time
    await prisma.connection.update({
      where: { id: connection.id },
      data: { lastSync: new Date() }
    });
    
    res.json({
      success: true,
      products_synced: syncedCount,
      total_products: storeProducts.length,
      page: page,
      results: results,
      message: 'Products synced successfully'
    });

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

    // Get store connection
    const connection = await prisma.connection.findFirst({
      where: { 
        id: parseInt(store_id),
        userId: userId
      }
    });

    if (!connection) {
      return res.status(404).json({ 
        success: false, 
        message: 'Store connection not found' 
      });
    }

    // Get Prokip config for stock deduction
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId }
    });

    if (!prokipConfig?.token || !prokipConfig.locationId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Prokip not configured. Please login to Prokip first.' 
      });
    }

    // Get orders from the store
    let orders = [];
    
    if (connection.platform === 'shopify') {
      orders = await getShopifyOrders(connection.storeUrl, connection.accessToken);
    } else if (connection.platform === 'woocommerce') {
      const { consumerKey, consumerSecret } = decryptCredentials(connection);
      orders = await getWooOrders(connection.storeUrl, consumerKey, consumerSecret, status);
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const paginatedOrders = orders.slice(startIndex, startIndex + limit);

    console.log(`🛒 Syncing ${paginatedOrders.length} orders from ${connection.platform} to Prokip`);
    
    let syncedCount = 0;
    const results = [];
    
    for (const order of paginatedOrders) {
      try {
        // Check if order already processed
        const existingLog = await prisma.salesLog.findFirst({
          where: { 
            connectionId: connection.id,
            orderId: order.id.toString()
          }
        });

        if (existingLog) {
          console.log(`Order ${order.id} already processed, skipping`);
          continue;
        }

        // Process order and create sale in Prokip
        const processResult = await processStoreToProkip(
          connection.storeUrl,
          'order.created',
          order,
          connection.platform,
          userId
        );

        if (processResult.success) {
          syncedCount++;
          results.push({
            order_id: order.id,
            status: 'success',
            total: order.total || order.total_price
          });
        } else {
          results.push({
            order_id: order.id,
            status: 'failed',
            error: processResult.error
          });
        }
        
      } catch (error) {
        console.error(`Failed to sync order ${order.id}:`, error.message);
        results.push({
          order_id: order.id,
          status: 'failed',
          error: error.message
        });
      }
    }

    // Update last sync time
    await prisma.connection.update({
      where: { id: connection.id },
      data: { lastSync: new Date() }
    });
    
    res.json({
      success: true,
      orders_synced: syncedCount,
      total_orders: orders.length,
      page: page,
      results: results,
      message: 'Orders synced successfully'
    });

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

    const stores = await prisma.connection.findMany({
      where: { userId },
      select: {
        id: true,
        platform: true,
        storeUrl: true,
        status: true,
        createdAt: true,
        lastSync: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      stores: stores.map(store => ({
        id: store.id,
        platform: store.platform,
        store_url: store.storeUrl,
        status: store.status,
        created_at: store.createdAt,
        last_sync: store.lastSync
      }))
    });

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

    const connection = await prisma.connection.findFirst({
      where: { 
        id: parseInt(store_id),
        userId: userId
      }
    });

    if (!connection) {
      return res.status(404).json({ 
        success: false, 
        message: 'Store connection not found' 
      });
    }

    let testResult;
    
    try {
      if (connection.platform === 'woocommerce') {
        const { consumerKey, consumerSecret } = decryptCredentials(connection);
        const { testWooConnection } = require('../services/wooService');
        testResult = await testWooConnection(connection.storeUrl, consumerKey, consumerSecret);
      } else if (connection.platform === 'shopify') {
        const { testShopifyConnection } = require('../services/shopifyService');
        testResult = await testShopifyConnection(connection.storeUrl, connection.accessToken);
      }
    } catch (error) {
      return res.json({
        success: false,
        status: 'failed',
        message: `Connection test failed: ${error.message}`
      });
    }

    res.json({
      success: testResult.success,
      status: testResult.success ? 'connected' : 'failed',
      message: testResult.message || 'Connection test completed'
    });

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
 * LEGACY ENDPOINTS (for backward compatibility)
 */

router.post('/', async (req, res) => {
  await pollProkipToStores();
  res.json({ success: true, message: 'Manual sync triggered' });
});

// Status endpoint doesn't require auth (public dashboard data)
router.get('/status', async (req, res) => {
  const connections = await prisma.connection.findMany();

  // Get Prokip transaction counts
  let prokipStats = { products: 0, sales: 0, purchases: 0 };

  try {
    // Get unique product count from inventory logs
    const prokipProducts = await prisma.inventoryLog.groupBy({
      by: ['sku'],
      _count: { sku: true }
    });
    prokipStats.products = prokipProducts.length;

    // Get sales count - count all completed/paid orders
    const salesCount = await prisma.salesLog.count({
      where: { 
        status: {
          in: ['completed', 'paid', 'processing']
        }
      }
    });

    prokipStats.sales = salesCount;
    prokipStats.purchases = 0; // Not tracked separately in current schema
  } catch (error) {
    console.error('Error fetching Prokip stats:', error);
  }

  const connectionsWithStats = await Promise.all(connections.map(async (c) => {
    let productCount = 0;
    let orderCount = 0;

    // Get product count for this connection
    try {
      productCount = await prisma.inventoryLog.count({
        where: { connectionId: c.id }
      });
    } catch (error) {
      productCount = 0;
    }

    // Get order count from SalesLog for this connection
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
