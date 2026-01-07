const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getShopifyProducts, getShopifyOrders } = require('../services/shopifyService');
const { getWooProducts, getWooOrders } = require('../services/wooService');

const router = express.Router();
const prisma = new PrismaClient();

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
      const rawProducts = await getWooProducts(connection.storeUrl, connection.consumerKey, connection.consumerSecret);
      products = rawProducts.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku || 'N/A',
        price: p.regular_price || '0.00',
        stock: p.stock_quantity || 0,
        synced: true
      }));
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

module.exports = router;
