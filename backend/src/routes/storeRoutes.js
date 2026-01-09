const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getShopifyProducts, getShopifyOrders } = require('../services/shopifyService');
const { getWooProducts, getWooOrders } = require('../services/wooService');
const wooSimpleAppPassword = require('../services/wooSimpleAppPassword');

const router = express.Router();
const prisma = new PrismaClient();

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
        
        // Quick test with just 1 product
        const testProducts = await getWooProducts(conn.storeUrl, conn.consumerKey, conn.consumerSecret);
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
 * Enhanced WooCommerce product fetching with fallback to working Consumer Key
 */
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
      const rawProducts = await getWooProducts(
        connection.storeUrl,
        connection.consumerKey,
        connection.consumerSecret
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
      const rawProducts = await getWooProducts(
        fallbackConnection.storeUrl,
        fallbackConnection.consumerKey,
        fallbackConnection.consumerSecret
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

// Get products for a specific store
router.get('/:id/products', async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id);
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId }
    });

    if (!connection) {
      return res.status(404).json({ error: 'Store not found' });
    }

    let products = [];
    
    if (connection.platform === 'shopify') {
      try {
        const rawProducts = await getShopifyProducts(connection.storeUrl, connection.accessToken);
        products = rawProducts.map(p => ({
          id: p.id,
          name: p.title,
          sku: p.variants[0]?.sku || 'N/A',
          price: p.variants[0]?.price || '0.00',
          stock: p.variants[0]?.inventory_quantity || 0,
          synced: true
        }));
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

    res.json(products);
  } catch (error) {
    console.error('Error fetching store products:', error);
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

    // Get product count
    let productCount = 0;
    if (connection.platform === 'shopify') {
      const products = await getShopifyProducts(connection.storeUrl, connection.accessToken);
      productCount = products.length;
    } else if (connection.platform === 'woocommerce') {
      const products = await getWooProducts(connection.storeUrl, connection.consumerKey, connection.consumerSecret);
      productCount = products.length;
    }

    // Get orders processed from SalesLog
    const ordersProcessed = await prisma.salesLog.count({
      where: { connectionId }
    });

    res.json({
      syncedProducts: productCount,
      ordersProcessed: ordersProcessed,
      lastSync: connection.lastSync
    });
  } catch (error) {
    console.error('Error fetching store analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
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

module.exports = router;
