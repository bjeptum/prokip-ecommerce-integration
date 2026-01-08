const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getShopifyProducts, getShopifyOrders } = require('../services/shopifyService');
const { getWooProducts, getWooOrders } = require('../services/wooService');
const wooSecureService = require('../services/wooSecureService');
const authenticateToken = require('../middlewares/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();

// Middleware to authenticate all routes
router.use(authenticateToken);

/**
 * Get products for a specific store (secure version)
 */
router.get('/:id/products', async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id);
    const userId = req.userId; // Fixed: use req.userId instead of req.user.id

    // Verify connection belongs to user
    const connection = await prisma.connection.findFirst({
      where: {
        id: connectionId,
        userId: userId
      }
    });

    if (!connection) {
      return res.status(404).json({ 
        error: 'Store not found',
        message: 'This store connection does not exist or you do not have access to it'
      });
    }

    let products = [];

    if (connection.platform === 'shopify') {
      try {
        const rawProducts = await getShopifyProducts(connection.storeUrl, connection.accessToken);
        products = rawProducts.map(p => ({
          id: p.id,
          name: p.title,
          sku: p.sku || 'N/A',
          price: p.variants?.[0]?.price || '0.00',
          stock: p.variants?.[0]?.inventory_quantity || 0,
          synced: true
        }));
      } catch (error) {
        console.error('Shopify products fetch failed:', error);
        return res.status(401).json({ 
          error: 'Shopify authentication failed',
          message: 'Please reconnect your Shopify store. The access token may have expired or been revoked.',
          reconnect: true,
          connectionId: connectionId
        });
      }
    } else if (connection.platform === 'woocommerce') {
      // Use secure WooCommerce product fetching
      console.log(`🛍️  Fetching products for ${connection.storeUrl}`);
      
      try {
        // Decrypt credentials
        if (!connection.consumerKey || !connection.consumerSecret) {
          return res.status(401).json({
            error: 'No credentials found',
            message: 'Please reconnect your WooCommerce store with Consumer Key and Secret',
            reconnect: true,
            connectionId: connectionId
          });
        }

        const consumerKey = wooSecureService.decrypt(JSON.parse(connection.consumerKey));
        const consumerSecret = wooSecureService.decrypt(JSON.parse(connection.consumerSecret));

        // Fetch products using secure service
        const client = wooSecureService.createAuthenticatedClient(
          connection.storeUrl,
          consumerKey,
          consumerSecret
        );

        const productsResponse = await client.get('products', {
          per_page: 100,
          status: 'publish'
        });

        const rawProducts = productsResponse.data;
        products = rawProducts.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku || 'N/A',
          price: p.regular_price || '0.00',
          stock: p.stock_quantity || 0,
          synced: true,
          image: p.images?.[0]?.src || null,
          status: p.status
        }));

        console.log(`✅ Successfully fetched ${products.length} products`);

      } catch (wooError) {
        console.error('❌ WooCommerce products fetch failed:', wooError.message);
        
        // Provide detailed error information
        const errorDetails = {
          error: 'WooCommerce authentication failed',
          message: 'Unable to fetch products from WooCommerce store',
          storeUrl: connection.storeUrl,
          suggestions: [
            'Check if Consumer Key and Secret are still valid',
            'Verify WooCommerce REST API is enabled',
            'Ensure API keys have product read permissions',
            'Check if store is accessible',
            'Try reconnecting your store'
          ]
        };

        if (wooError.response?.data?.code === 'woocommerce_rest_cannot_view') {
          errorDetails.permissionIssue = true;
          errorDetails.message = 'API keys lack WooCommerce product permissions';
          errorDetails.suggestions.unshift('Update API key permissions in WooCommerce settings');
        } else if (wooError.response?.status === 401) {
          errorDetails.message = 'Invalid Consumer Key or Secret';
          errorDetails.reconnect = true;
          errorDetails.connectionId = connectionId;
        }

        return res.status(401).json(errorDetails);
      }
    }

    res.json(products);

  } catch (error) {
    console.error('Error fetching store products:', error);
    res.status(500).json({ 
      error: 'Failed to fetch products',
      message: 'An unexpected error occurred while fetching products'
    });
  }
});

/**
 * Get orders for a specific store (secure version)
 */
router.get('/:id/orders', async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id);
    const userId = req.user.id;

    // Verify connection belongs to user
    const connection = await prisma.connection.findFirst({
      where: {
        id: connectionId,
        userId: userId
      }
    });

    if (!connection) {
      return res.status(404).json({ 
        error: 'Store not found',
        message: 'This store connection does not exist or you do not have access to it'
      });
    }

    let orders = [];

    if (connection.platform === 'shopify') {
      try {
        const rawOrders = await getShopifyOrders(connection.storeUrl, connection.accessToken);
        orders = rawOrders.map(o => ({
          id: o.id,
          number: o.name || o.order_number,
          customer: o.customer?.first_name + ' ' + o.customer?.last_name || 'Unknown',
          email: o.customer?.email || 'N/A',
          total: o.total_price || '0.00',
          status: o.financial_status || 'pending',
          date: o.created_at,
          synced: true
        }));
      } catch (error) {
        console.error('Shopify orders fetch failed:', error);
        return res.status(401).json({ 
          error: 'Shopify authentication failed',
          message: 'Please reconnect your Shopify store. The access token may have expired or been revoked.',
          reconnect: true,
          connectionId: connectionId
        });
      }
    } else if (connection.platform === 'woocommerce') {
      // Use secure WooCommerce order fetching
      console.log(`📦 Fetching orders for ${connection.storeUrl}`);
      
      try {
        // Decrypt credentials
        if (!connection.consumerKey || !connection.consumerSecret) {
          return res.status(401).json({
            error: 'No credentials found',
            message: 'Please reconnect your WooCommerce store with Consumer Key and Secret',
            reconnect: true,
            connectionId: connectionId
          });
        }

        const consumerKey = wooSecureService.decrypt(JSON.parse(connection.consumerKey));
        const consumerSecret = wooSecureService.decrypt(JSON.parse(connection.consumerSecret));

        // Fetch orders using secure service
        const client = wooSecureService.createAuthenticatedClient(
          connection.storeUrl,
          consumerKey,
          consumerSecret
        );

        const ordersResponse = await client.get('orders', {
          per_page: 50,
          status: 'any'
        });

        const rawOrders = ordersResponse.data;
        orders = rawOrders.map(o => ({
          id: o.id,
          number: o.number,
          customer: `${o.billing.first_name} ${o.billing.last_name}`.trim() || 'Unknown',
          email: o.billing.email || 'N/A',
          total: o.total || '0.00',
          status: o.status,
          date: o.date_created,
          synced: true,
          payment_method: o.payment_method || 'N/A'
        }));

        console.log(`✅ Successfully fetched ${orders.length} orders`);

      } catch (wooError) {
        console.error('❌ WooCommerce orders fetch failed:', wooError.message);
        
        const errorDetails = {
          error: 'WooCommerce authentication failed',
          message: 'Unable to fetch orders from WooCommerce store',
          storeUrl: connection.storeUrl,
          suggestions: [
            'Check if Consumer Key and Secret are still valid',
            'Verify WooCommerce REST API is enabled',
            'Ensure API keys have order read permissions',
            'Check if store is accessible',
            'Try reconnecting your store'
          ]
        };

        if (wooError.response?.status === 401) {
          errorDetails.message = 'Invalid Consumer Key or Secret';
          errorDetails.reconnect = true;
          errorDetails.connectionId = connectionId;
        }

        return res.status(401).json(errorDetails);
      }
    }

    res.json(orders);

  } catch (error) {
    console.error('Error fetching store orders:', error);
    res.status(500).json({ 
      error: 'Failed to fetch orders',
      message: 'An unexpected error occurred while fetching orders'
    });
  }
});

/**
 * Get store details
 */
router.get('/:id/details', async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id);
    const userId = req.user.id;

    const connection = await prisma.connection.findFirst({
      where: {
        id: connectionId,
        userId: userId
      },
      select: {
        id: true,
        platform: true,
        storeUrl: true,
        storeName: true,
        lastSync: true,
        syncEnabled: true,
        createdAt: true,
        consumerKey: true
      }
    });

    if (!connection) {
      return res.status(404).json({ 
        error: 'Store not found',
        message: 'This store connection does not exist or you do not have access to it'
      });
    }

    // Format for display (hide sensitive data)
    const formattedConnection = {
      ...connection,
      consumerKey: connection.consumerKey ? wooSecureService.formatConsumerKeyForDisplay(
        JSON.parse(connection.consumerKey).encrypted
      ) : null,
      hasCredentials: !!(connection.consumerKey && connection.consumerSecret)
    };

    res.json(formattedConnection);

  } catch (error) {
    console.error('Error fetching store details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch store details',
      message: 'An unexpected error occurred while fetching store details'
    });
  }
});

/**
 * Get sales for a specific store (secure version)
 */
router.get('/:id/sales', async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id);
    const userId = req.userId;

    // Verify connection belongs to user
    const connection = await prisma.connection.findFirst({
      where: {
        id: connectionId,
        userId: userId
      }
    });

    if (!connection) {
      return res.status(404).json({ 
        error: 'Store not found',
        message: 'This store connection does not exist or you do not have access to it'
      });
    }

    let sales = [];

    if (connection.platform === 'woocommerce') {
      try {
        // Decrypt credentials
        if (!connection.consumerKey || !connection.consumerSecret) {
          return res.status(401).json({
            error: 'No credentials found',
            message: 'Please reconnect your WooCommerce store with Consumer Key and Secret',
            reconnect: true,
            connectionId: connectionId
          });
        }

        const consumerKey = wooSecureService.decrypt(JSON.parse(connection.consumerKey));
        const consumerSecret = wooSecureService.decrypt(JSON.parse(connection.consumerSecret));

        // Fetch sales using secure service
        const client = wooSecureService.createAuthenticatedClient(
          connection.storeUrl,
          consumerKey,
          consumerSecret
        );

        console.log(`🔍 Fetching orders from: ${connection.storeUrl}/wp-json/wc/v3/orders`);
        const salesResponse = await client.get('orders', {
          per_page: 100
        });

        console.log('📊 Raw orders response:', salesResponse.data);
        console.log('📊 Response status:', salesResponse.status);
        console.log('📊 Response headers:', salesResponse.headers);
        
        const rawSales = salesResponse.data;
        console.log(`📈 Found ${rawSales.length} orders`);
        
        if (rawSales.length > 0) {
          console.log('📝 First order sample:', rawSales[0]);
        }
        
        sales = rawSales.map(sale => ({
          id: sale.id,
          orderId: sale.number,
          date: sale.date_created,
          customer: `${sale.billing.first_name} ${sale.billing.last_name}`.trim() || 'Guest',
          productCount: sale.line_items?.length || 0,
          total: parseFloat(sale.total) || 0,
          status: sale.status,
          paymentMethod: sale.payment_method,
          shippingAddress: `${sale.shipping.address_1}, ${sale.shipping.city}, ${sale.shipping.country}`
        }));

        console.log(`✅ Successfully fetched ${sales.length} sales`);

      } catch (wooError) {
        console.error('❌ WooCommerce sales fetch failed:', wooError.message);
        
        // Provide detailed error information
        const errorDetails = {
          error: 'WooCommerce authentication failed',
          message: 'Unable to fetch sales from WooCommerce store',
          storeUrl: connection.storeUrl,
          suggestions: [
            'Check if Consumer Key and Secret are still valid',
            'Verify WooCommerce REST API is enabled',
            'Ensure API keys have order read permissions',
            'Check if store is accessible',
            'Try reconnecting your store'
          ]
        };

        if (wooError.response?.data?.code === 'woocommerce_rest_cannot_view') {
          errorDetails.permissionIssue = true;
          errorDetails.message = 'API keys lack WooCommerce order permissions';
          errorDetails.suggestions.unshift('Update API key permissions in WooCommerce settings');
        } else if (wooError.response?.status === 401) {
          errorDetails.message = 'Invalid Consumer Key or Secret';
          errorDetails.reconnect = true;
          errorDetails.connectionId = connectionId;
        }

        return res.status(401).json(errorDetails);
      }
    } else if (connection.platform === 'shopify') {
      // TODO: Implement Shopify sales fetching
      sales = [];
    }

    res.json(sales);

  } catch (error) {
    console.error('Error fetching store sales:', error);
    res.status(500).json({ 
      error: 'Failed to fetch sales',
      message: 'An unexpected error occurred while fetching sales'
    });
  }
});

module.exports = router;
