const express = require('express');
const prisma = require('../lib/prisma');
const { getShopifyProducts, getShopifyOrders } = require('../services/shopifyService');
const { getWooProducts, getWooOrders } = require('../services/wooService');
const wooSimpleAppPassword = require('../services/wooSimpleAppPassword');
const wooSecureService = require('../services/wooSecureService');
const authenticateToken = require('../middlewares/authMiddleware');

const router = express.Router();

// Custom authentication middleware for store routes
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
      console.error('Authentication error:', dbError);
      return res.status(500).json({ error: 'Authentication failed' });
    }
  }
});

/**
 * Helper function to decrypt Consumer Key/Secret if encrypted
 */
function decryptCredentials(connection) {
  let consumerKey = connection.consumerKey;
  let consumerSecret = connection.consumerSecret;
  
  // Check if credentials are encrypted (they will be JSON objects with "encrypted" field)
  if (consumerKey && typeof consumerKey === 'string' && consumerKey.startsWith('{"encrypted":')) {
    try {
      const encryptedData = JSON.parse(consumerKey);
      consumerKey = wooSecureService.decrypt(encryptedData);
      console.log('✅ Consumer Key decrypted successfully');
    } catch (error) {
      console.error('❌ Failed to decrypt Consumer Key:', error.message);
      throw new Error('Failed to decrypt Consumer Key');
    }
  }
  
  if (consumerSecret && typeof consumerSecret === 'string' && consumerSecret.startsWith('{"encrypted":')) {
    try {
      const encryptedData = JSON.parse(consumerSecret);
      consumerSecret = wooSecureService.decrypt(encryptedData);
      console.log('✅ Consumer Secret decrypted successfully');
    } catch (error) {
      console.error('❌ Failed to decrypt Consumer Secret:', error.message);
      throw new Error('Failed to decrypt Consumer Secret');
    }
  }
  
  return { consumerKey, consumerSecret };
}

/**
 * Find working Consumer Key connection for the same domain
 */
async function findWorkingConsumerKey(storeUrl) {
  try {
    // Extract domain from store URL
    const url = new URL(storeUrl);
    const domain = url.hostname; // e.g., 'prowebfunnels.com'
    
    // Find all connections for this domain with Consumer Keys
    const domainConnections = await prisma.connection.findMany({
      where: {
        platform: 'woocommerce',
        storeUrl: {
          contains: domain
        },
        consumerKey: {
          not: null
        },
        consumerSecret: {
          not: null
        }
      }
    });
    
    // Test each connection to find working one
    for (const conn of domainConnections) {
      try {
        console.log(`Testing Consumer Key connection: ${conn.storeUrl} (ID: ${conn.id})`);
        
        // Decrypt credentials before using them
        const { consumerKey, consumerSecret } = decryptCredentials(conn);
        
        // Quick test with just 1 product
        const testProducts = await getWooProducts(conn.storeUrl, consumerKey, consumerSecret);
        console.log(`✅ Working Consumer Key found: ${conn.storeUrl} (${testProducts.length} products)`);
        return conn;
      } catch (error) {
        console.log(`❌ Consumer Key connection ${conn.id} failed: ${error.message}`);
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error finding working Consumer Key:', error);
    return null;
  }
}

/**
 * Enhanced WooCommerce order fetching with fallback to working Consumer Key
 */
async function fetchWooCommerceOrders(connection) {
  let lastError = null;
  
  // Strategy 1: Try Application Password first
  if (connection.wooUsername && connection.wooAppPassword) {
    console.log('🔐 Strategy 1: Using Application Password for orders');
    
    try {
      // Test if Application Password has WooCommerce permissions
      const capabilityCheck = await wooSimpleAppPassword.checkWooCommerceCapabilities(
        connection.storeUrl,
        connection.wooUsername,
        connection.wooAppPassword
      );
      
      if (capabilityCheck.success) {
        console.log('✅ Application Password has WooCommerce permissions for orders');
        
        // Fetch orders using Application Password
        const rawOrders = await getWooOrders(
          connection.storeUrl,
          null, null, null, null,
          connection.wooUsername,
          connection.wooAppPassword
        );
        
        console.log(`✅ Application Password successful for orders: ${rawOrders.length} orders`);
        return rawOrders;
      } else {
        console.log('❌ Application Password lacks WooCommerce permissions for orders');
        console.log(`Issue: ${capabilityCheck.issue}`);
        console.log(`Message: ${capabilityCheck.message}`);
        lastError = new Error(capabilityCheck.message);
      }
    } catch (error) {
      console.log('❌ Application Password failed for orders:', error.message);
      lastError = error;
    }
  }
  
  // Strategy 2: Try Consumer Key/Secret if available
  if (connection.consumerKey && connection.consumerSecret) {
    console.log('🔑 Strategy 2: Using Consumer Key/Secret for orders');
    
    try {
      // Decrypt credentials before using them
      const { consumerKey, consumerSecret } = decryptCredentials(connection);
      
      const rawOrders = await getWooOrders(
        connection.storeUrl,
        consumerKey,
        consumerSecret
      );
      
      console.log(`✅ Consumer Key/Secret successful for orders: ${rawOrders.length} orders`);
      return rawOrders;
    } catch (error) {
      console.log('❌ Consumer Key/Secret failed for orders:', error.message);
      console.log('❌ Full error details:', {
        storeUrl: connection.storeUrl,
        consumerKey: consumerKey ? 'present' : 'missing',
        consumerSecret: consumerSecret ? 'present' : 'missing',
        errorMessage: error.message,
        responseStatus: error.response?.status,
        responseData: error.response?.data
      });
      lastError = error;
    }
  }
  
  // Strategy 3: Fallback to working Consumer Key from same domain
  console.log('🔄 Strategy 3: Looking for working Consumer Key fallback for orders');
  const fallbackConnection = await findWorkingConsumerKey(connection.storeUrl);
  
  if (fallbackConnection) {
    console.log(`🔄 Using fallback Consumer Key for orders: ${fallbackConnection.storeUrl}`);
    
    try {
      // Decrypt fallback credentials before using them
      const { consumerKey, consumerSecret } = decryptCredentials(fallbackConnection);
      
      const rawOrders = await getWooOrders(
        fallbackConnection.storeUrl,
        consumerKey,
        consumerSecret
      );
      
      console.log(`✅ Fallback successful for orders: ${rawOrders.length} orders`);
      return rawOrders;
    } catch (error) {
      console.log('❌ Fallback failed for orders:', error.message);
      lastError = error;
    }
  } else {
    console.log('❌ No working Consumer Key fallback found for orders');
  }
  
  // All strategies failed
  console.log('❌ All authentication strategies failed for orders');
  throw lastError || new Error('Unable to fetch orders with any available authentication method');
}
async function fetchWooCommerceProducts(connection) {
  let lastError = null;
  
  // Strategy 1: Try Application Password first
  if (connection.wooUsername && connection.wooAppPassword) {
    console.log('🔐 Strategy 1: Using Application Password');
    
    try {
      // Test if Application Password has WooCommerce permissions
      const capabilityCheck = await wooSimpleAppPassword.checkWooCommerceCapabilities(
        connection.storeUrl,
        connection.wooUsername,
        connection.wooAppPassword
      );
      
      if (capabilityCheck.success) {
        console.log('✅ Application Password has WooCommerce permissions');
        
        // Fetch products using Application Password
        const rawProducts = await getWooProducts(
          connection.storeUrl,
          null, null, null, null,
          connection.wooUsername,
          connection.wooAppPassword
        );
        
        console.log(`✅ Application Password successful: ${rawProducts.length} products`);
        return rawProducts;
      } else {
        console.log('❌ Application Password lacks WooCommerce permissions');
        console.log(`Issue: ${capabilityCheck.issue}`);
        console.log(`Message: ${capabilityCheck.message}`);
        lastError = new Error(capabilityCheck.message);
      }
    } catch (error) {
      console.log('❌ Application Password failed:', error.message);
      lastError = error;
    }
  }
  
  // Strategy 2: Try Consumer Key/Secret if available
  if (connection.consumerKey && connection.consumerSecret) {
    console.log('🔑 Strategy 2: Using Consumer Key/Secret');
    
    try {
      // Decrypt credentials before using them
      const { consumerKey, consumerSecret } = decryptCredentials(connection);
      
      const rawProducts = await getWooProducts(
        connection.storeUrl,
        consumerKey,
        consumerSecret
      );
      
      console.log(`✅ Consumer Key/Secret successful: ${rawProducts.length} products`);
      return rawProducts;
    } catch (error) {
      console.log('❌ Consumer Key/Secret failed:', error.message);
      lastError = error;
    }
  }
  
  // Strategy 3: Fallback to working Consumer Key from same domain
  console.log('🔄 Strategy 3: Looking for working Consumer Key fallback');
  const fallbackConnection = await findWorkingConsumerKey(connection.storeUrl);
  
  if (fallbackConnection) {
    console.log(`🔄 Using fallback Consumer Key: ${fallbackConnection.storeUrl}`);
    
    try {
      // Decrypt fallback credentials before using them
      const { consumerKey, consumerSecret } = decryptCredentials(fallbackConnection);
      
      const rawProducts = await getWooProducts(
        fallbackConnection.storeUrl,
        consumerKey,
        consumerSecret
      );
      
      console.log(`✅ Fallback successful: ${rawProducts.length} products`);
      return rawProducts;
    } catch (error) {
      console.log('❌ Fallback failed:', error.message);
      lastError = error;
    }
  } else {
    console.log('❌ No working Consumer Key fallback found');
  }
  
  // All strategies failed
  console.log('❌ All authentication strategies failed');
  throw lastError || new Error('Unable to fetch products with any available authentication method');
}

// Dynamic endpoint - find user's WooCommerce connection automatically
router.get('/my-store/products', async (req, res) => {
  try {
    // Get user's Prokip config to ensure location-based isolation
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: req.userId }
    });

    if (!prokipConfig) {
      return res.status(404).json({ error: 'No Prokip configuration found for this user' });
    }

    // Get connection ID from query parameter or use the first one as fallback
    let connectionId = req.query.connectionId;
    
    if (connectionId) {
      // Use specific connection ID
      connectionId = parseInt(connectionId);
    } else {
      // Fallback: find first connection (either WooCommerce or Shopify)
      const firstConnection = await prisma.connection.findFirst({
        where: { 
          userId: req.userId
        }
      });
      connectionId = firstConnection?.id;
    }

    if (!connectionId) {
      return res.status(404).json({ error: 'No store connections found for this user' });
    }

    // Find the specific connection (support both platforms)
    const connection = await prisma.connection.findFirst({
      where: { 
        id: connectionId,
        userId: req.userId
      }
    });

    if (!connection) {
      return res.status(404).json({ error: 'Store connection not found' });
    }

    console.log(`📦 Fetching products for user ${req.userId}, location ${prokipConfig.locationId}, connection ID: ${connection.id}, platform: ${connection.platform}`);
    
    let products = [];
    
    if (connection.platform === 'woocommerce') {
      // Use the enhanced WooCommerce product fetching
      products = await fetchWooCommerceProducts(connection);
      
      // Add location information to each product for frontend filtering
      products = products.map(product => ({
        ...product,
        locationId: prokipConfig.locationId,
        userId: req.userId
      }));
    } else if (connection.platform === 'shopify') {
      // Use Shopify product fetching
      products = await getShopifyProducts(connection.storeUrl, connection.accessToken);
      
      // Transform Shopify products to match frontend expectations
      products = products.map(shopifyProduct => {
        const variant = shopifyProduct.variants && shopifyProduct.variants[0] ? shopifyProduct.variants[0] : {};
        return {
          id: shopifyProduct.id,
          name: shopifyProduct.title,
          title: shopifyProduct.title,
          sku: variant.sku || shopifyProduct.handle || 'N/A',
          price: variant.price || 0,
          stock_quantity: variant.inventory_quantity || 0,
          created_at: shopifyProduct.created_at,
          updated_at: shopifyProduct.updated_at,
          vendor: shopifyProduct.vendor,
          product_type: shopifyProduct.product_type
        };
      });
      
      // Add location information to each product for frontend filtering
      products = products.map(product => ({
        ...product,
        locationId: prokipConfig.locationId,
        userId: req.userId
      }));
    }

    res.json({ 
      products: products,
      connectionId: connection.id,
      storeUrl: connection.storeUrl,
      locationId: prokipConfig.locationId,
      userId: req.userId
    });
    
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ 
      error: 'Failed to fetch products',
      details: error.message 
    });
  }
});

// Dynamic endpoint - find user's WooCommerce orders automatically  
router.get('/my-store/orders', async (req, res) => {
  try {
    // Get user's Prokip config to ensure location-based isolation
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: req.userId }
    });

    if (!prokipConfig) {
      return res.status(404).json({ error: 'No Prokip configuration found for this user' });
    }

    // Get connection ID from query parameter or use the first one as fallback
    let connectionId = req.query.connectionId;
    
    if (connectionId) {
      // Use specific connection ID
      connectionId = parseInt(connectionId);
    } else {
      // Fallback: find first connection (either WooCommerce or Shopify)
      const firstConnection = await prisma.connection.findFirst({
        where: { 
          userId: req.userId
        }
      });
      connectionId = firstConnection?.id;
    }

    if (!connectionId) {
      return res.status(404).json({ error: 'No store connections found for this user' });
    }

    // Find the specific connection (support both platforms)
    const connection = await prisma.connection.findFirst({
      where: { 
        id: connectionId,
        userId: req.userId
      }
    });

    if (!connection) {
      return res.status(404).json({ error: 'Store connection not found' });
    }

    console.log(`💰 Fetching orders for user ${req.userId}, location ${prokipConfig.locationId}, connection ID: ${connection.id}, platform: ${connection.platform}`);
    
    let orders = [];
    
    if (connection.platform === 'woocommerce') {
      orders = await fetchWooCommerceOrders(connection);
      
      // Add location information to each order for frontend filtering
      orders = orders.map(order => ({
        ...order,
        locationId: prokipConfig.locationId,
        userId: req.userId
      }));
    } else if (connection.platform === 'shopify') {
      orders = await getShopifyOrders(connection.storeUrl, connection.accessToken);
      
      // Add location information to each order for frontend filtering
      orders = orders.map(order => ({
        ...order,
        locationId: prokipConfig.locationId,
        userId: req.userId
      }));
    }

    res.json({ 
      orders: orders,
      connectionId: connection.id,
      storeUrl: connection.storeUrl,
      locationId: prokipConfig.locationId,
      userId: req.userId
    });
    
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ 
      error: 'Failed to fetch orders',
      details: error.message 
    });
  }
});

// Dynamic endpoint - find user's store analytics automatically
router.get('/my-store/analytics', async (req, res) => {
  try {
    // Get user's Prokip config to ensure location-based isolation
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: req.userId }
    });

    if (!prokipConfig) {
      return res.status(404).json({ error: 'No Prokip configuration found for this user' });
    }

    // Find store connection for current user (either WooCommerce or Shopify)
    const connection = await prisma.connection.findFirst({
      where: { 
        userId: req.userId 
      }
    });

    if (!connection) {
      return res.status(404).json({ error: 'No store connections found for this user' });
    }

    console.log(`📊 Fetching analytics for user ${req.userId}, location ${prokipConfig.locationId}, connection ID: ${connection.id}`);
    
    // Get product count
    let productCount = 0;
    if (connection.platform === 'woocommerce') {
      // Use enhanced WooCommerce product fetching with decryption
      const products = await fetchWooCommerceProducts(connection);
      productCount = products.length;
    }

    // Get orders processed from SalesLog - filtered by user and location
    const ordersProcessed = await prisma.salesLog.count({
      where: { 
        connectionId: connection.id,
        // Add additional filtering by location if available in SalesLog
        ...(prokipConfig.locationId && { locationId: prokipConfig.locationId })
      }
    });

    res.json({
      syncedProducts: productCount,
      ordersProcessed: ordersProcessed,
      lastSync: connection.lastSync,
      connectionId: connection.id,
      storeUrl: connection.storeUrl,
      locationId: prokipConfig.locationId,
      userId: req.userId
    });
    
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch analytics',
      details: error.message 
    });
  }
});
router.get('/:id/products', async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id);
    console.log(`📦 Fetching products for connection ID: ${connectionId}`);
    
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId }
    });

    if (!connection) {
      console.log(`❌ Connection ${connectionId} not found`);
      return res.status(404).json({ error: 'Store not found' });
    }

    console.log(`✅ Found connection: ${connection.platform} - ${connection.storeUrl}`);
    let products = [];
    
    if (connection.platform === 'shopify') {
      try {
        console.log(`🛍️ Fetching products from Shopify: ${connection.storeUrl}`);
        const rawProducts = await getShopifyProducts(connection.storeUrl, connection.accessToken);
        console.log(`📊 Raw Shopify products received: ${rawProducts?.length || 0} items`);
        
        products = rawProducts.map(p => ({
          id: p.id,
          name: p.title,
          sku: p.variants[0]?.sku || 'N/A',
          price: p.variants[0]?.price || '0.00',
          stock: p.variants[0]?.inventory_quantity || 0,
          synced: true
        }));
        console.log(`✅ Mapped ${products.length} Shopify products`);
      } catch (error) {
        console.error(`Shopify API error for ${connection.storeUrl}:`, error.message);
        
        // If it's an authentication error, suggest reconnecting
        if (error.message.includes('Invalid API key') || error.message.includes('access token')) {
          return res.status(401).json({ 
            error: 'Shopify authentication failed',
            message: 'Please reconnect your Shopify store. The access token may have expired or been revoked.',
            reconnect: true,
            connectionId: connectionId
          });
        }
        throw error;
      }
    } else if (connection.platform === 'woocommerce') {
      // Use enhanced WooCommerce product fetching
      console.log(`🛍️  Fetching products for ${connection.storeUrl}`);
      
      try {
        const rawProducts = await fetchWooCommerceProducts(connection);
        products = rawProducts.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku || 'N/A',
          price: p.regular_price || '0.00',
          stock: p.stock_quantity || 0,
          synced: true
        }));
        
        console.log(`✅ Successfully fetched ${products.length} products`);
        
      } catch (wooError) {
        console.error('❌ All WooCommerce authentication methods failed');
        
        // Provide detailed error information
        const errorDetails = {
          error: 'WooCommerce authentication failed',
          message: 'Unable to fetch products from WooCommerce store',
          storeUrl: connection.storeUrl,
          availableMethods: {
            applicationPassword: !!(connection.wooUsername && connection.wooAppPassword),
            consumerKey: !!(connection.consumerKey && connection.consumerSecret)
          },
          suggestions: [
            'Check if user has WooCommerce REST API permissions',
            'Verify WooCommerce REST API is enabled in settings',
            'Try reconnecting with Consumer Key/Secret method',
            'Check for security plugin restrictions',
            'Ensure user has Administrator role in WordPress'
          ]
        };
        
        if (wooError.response?.data?.code === 'woocommerce_rest_cannot_view') {
          errorDetails.permissionIssue = true;
          errorDetails.message = 'User lacks WooCommerce REST API permissions';
        }
        
        return res.status(401).json(errorDetails);
      }
    }

    console.log(`📤 Returning ${products.length} products`);
    res.json(products);
  } catch (error) {
    console.error('❌ Error fetching store products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get orders for a specific store
router.get('/:id/orders', async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id);
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId }
    });

    if (!connection) {
      return res.status(404).json({ error: 'Store not found' });
    }

    let orders = [];
    
    if (connection.platform === 'shopify') {
      const rawOrders = await getShopifyOrders(connection.storeUrl, connection.accessToken);
      orders = rawOrders.map(o => ({
        orderId: o.order_number || o.id,
        customer: `${o.customer?.first_name || ''} ${o.customer?.last_name || ''}`.trim() || 'Guest',
        date: o.created_at,
        total: o.total_price,
        status: o.financial_status || 'pending'
      }));
    } else if (connection.platform === 'woocommerce') {
      const rawOrders = await getWooOrders(connection.storeUrl, connection.consumerKey, connection.consumerSecret);
      orders = rawOrders.map(o => ({
        orderId: o.number || o.id,
        customer: `${o.billing?.first_name || ''} ${o.billing?.last_name || ''}`.trim() || 'Guest',
        date: o.date_created,
        total: o.total,
        status: o.status || 'pending'
      }));
    }

    res.json(orders);
  } catch (error) {
    console.error('Error fetching store orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get analytics for a specific store
router.get('/:id/analytics', async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id);
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId }
    });

    if (!connection) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // Get product count - try API first, fallback to cached inventory
    let productCount = 0;
    if (connection.platform === 'shopify') {
      const products = await getShopifyProducts(connection.storeUrl, connection.accessToken);
      productCount = products.length;
    } else if (connection.platform === 'woocommerce') {
      // Use correct credential fields
      const products = await getWooProducts(connection.storeUrl, connection.wooUsername, connection.wooAppPassword);
      productCount = products.length;
    }

    // Get orders processed from SalesLog
    const ordersProcessed = await prisma.salesLog.count({
      where: { connectionId }
    });

    // Get inventory updates count
    const inventoryUpdates = await prisma.inventoryLog.count({
      where: { connectionId }
    });

    // Get recent sync errors
    const recentErrors = await prisma.syncError.count({
      where: { 
        connectionId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      }
    });

    // Calculate sync success rate
    const totalSyncs = ordersProcessed + inventoryUpdates;
    const syncSuccessRate = totalSyncs > 0 ? Math.round(((totalSyncs - recentErrors) / totalSyncs) * 100) : 100;

    res.json({
      syncedProducts: productCount,
      ordersProcessed: ordersProcessed,
      inventoryUpdates: inventoryUpdates,
      recentErrors: recentErrors,
      syncSuccessRate: syncSuccessRate,
      lastSync: connection.lastSync,
      platform: connection.platform,
      storeUrl: connection.storeUrl
    });
  } catch (error) {
    console.error('Error fetching store analytics:', error);
    // Return partial data even on error
    res.json({
      syncedProducts: 0,
      ordersProcessed: 0,
      inventoryUpdates: 0,
      recentErrors: 0,
      syncSuccessRate: 100,
      lastSync: null,
      error: 'Some analytics data could not be loaded'
    });
  }
});

// Get sales for a specific store (returns orders as sales)
router.get('/:id/sales', async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id);
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId }
    });

    if (!connection) {
      return res.status(404).json({ error: 'Store not found' });
    }

    let sales = [];
    
    if (connection.platform === 'shopify') {
      const rawOrders = await getShopifyOrders(connection.storeUrl, connection.accessToken);
      // Filter only completed/paid orders
      const paidOrders = rawOrders.filter(o => ['paid', 'partially_paid'].includes(o.financial_status));
      sales = paidOrders.map(o => ({
        id: o.id,
        orderId: o.order_number || o.id,
        customer: `${o.customer?.first_name || ''} ${o.customer?.last_name || ''}`.trim() || 'Guest',
        date: o.created_at,
        productCount: o.line_items?.length || 0,
        quantitySold: o.line_items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
        total: parseFloat(o.total_price || 0),
        status: o.financial_status || 'paid',
        source: 'store'
      }));
    } else if (connection.platform === 'woocommerce') {
      const rawOrders = await getWooOrders(connection.storeUrl, connection.consumerKey, connection.consumerSecret);
      // Filter only completed/processing orders
      const completedOrders = rawOrders.filter(o => ['completed', 'processing'].includes(o.status));
      sales = completedOrders.map(o => ({
        id: o.id,
        orderId: o.number || o.id,
        customer: `${o.billing?.first_name || ''} ${o.billing?.last_name || ''}`.trim() || 'Guest',
        date: o.date_created,
        productCount: o.line_items?.length || 0,
        quantitySold: o.line_items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
        total: parseFloat(o.total || 0),
        status: o.status || 'completed',
        source: 'store'
      }));
    }

    res.json(sales);
  } catch (error) {
    console.error('Error fetching store sales:', error);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// Get all synced products from both Prokip and store
router.get('/synced-products', authenticateToken, async (req, res) => {
  try {
    const connectionId = parseInt(req.query.connectionId);
    const userId = req.userId;
    
    if (!connectionId) {
      return res.status(400).json({ error: 'Connection ID is required' });
    }
    
    const connection = await prisma.connection.findFirst({
      where: { 
        id: connectionId,
        userId: userId
      }
    });
    
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found or access denied' });
    }
    
    const prokipService = require('../services/prokipService');
    let allProducts = [];
    
    // Get Prokip products
    const prokipProducts = await prokipService.getProducts(null, userId);
    
    // Get store products
    let storeProducts = [];
    if (connection.platform === 'shopify') {
      const { getShopifyProducts } = require('../services/shopifyService');
      storeProducts = await getShopifyProducts(connection.storeUrl, connection.accessToken);
      storeProducts = storeProducts.map(shopifyProduct => {
        const variant = shopifyProduct.variants && shopifyProduct.variants[0] ? shopifyProduct.variants[0] : {};
        return {
          id: shopifyProduct.id,
          name: shopifyProduct.title,
          sku: variant.sku || shopifyProduct.handle || 'N/A',
          price: parseFloat(variant.price) || 0,
          stock_quantity: variant.inventory_quantity || 0,
          source: 'shopify'
        };
      });
    }
    
    // Combine and mark sync status
    for (const prokipProduct of prokipProducts) {
      const storeProduct = storeProducts.find(sp => sp.sku === prokipProduct.sku);
      allProducts.push({
        ...prokipProduct,
        source: 'prokip',
        syncedToStore: !!storeProduct,
        storeStock: storeProduct ? storeProduct.stock_quantity : null,
        stockDifference: storeProduct ? (prokipProduct.quantity || 0) - storeProduct.stock_quantity : null
      });
    }
    
    for (const storeProduct of storeProducts) {
      const prokipProduct = allProducts.find(ap => ap.sku === storeProduct.sku);
      if (!prokipProduct) {
        allProducts.push({
          ...storeProduct,
          source: 'store',
          syncedToProkip: false,
          prokipStock: null
        });
      }
    }
    
    res.json({
      products: allProducts,
      connectionId: connection.id,
      platform: connection.platform
    });
    
  } catch (error) {
    console.error('Error fetching synced products:', error);
    res.status(500).json({ 
      error: 'Failed to fetch synced products',
      details: error.message 
    });
  }
});

module.exports = router;
