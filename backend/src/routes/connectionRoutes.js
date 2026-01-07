const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { body, query, validationResult } = require('express-validator');
const bodyParser = require('body-parser');
const { registerShopifyWebhooks, getShopifyProducts, getShopifyOrders } = require('../services/shopifyService');
const { registerWooWebhooks, getWooProducts, getWooOrders } = require('../services/wooService');
const { processStoreToProkip } = require('../services/syncService');

const router = express.Router();
const prisma = new PrismaClient();

// Helper function to normalize Shopify store URL
function normalizeShopifyUrl(storeUrl) {
  // Remove any protocol
  let normalized = storeUrl.replace(/^https?:\/\//, '');
  
  // Remove trailing slashes
  normalized = normalized.replace(/\/+$/, '');
  
  // If it doesn't end with .myshopify.com, add it
  if (!normalized.endsWith('.myshopify.com')) {
    normalized = `${normalized}.myshopify.com`;
  }
  
  return normalized;
}

// Shopify OAuth start (legacy)
router.get('/shopify', [
  query('store').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { store } = req.query;
  const state = crypto.randomBytes(16).toString('hex');
  const scopes = process.env.SHOPIFY_SCOPES || 'read_products,write_products,read_inventory,write_inventory,read_orders,write_orders';
  const redirectUri = process.env.REDIRECT_URI;

  const authorizeUrl = `https://${store}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  res.redirect(authorizeUrl);
});

// New Shopify connection initiation endpoint
router.post('/shopify/initiate', [
  body('storeUrl').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { storeUrl } = req.body;
    
    // Normalize the store URL
    const normalizedUrl = normalizeShopifyUrl(storeUrl);
    
    const state = crypto.randomBytes(16).toString('hex');
    const scopes = process.env.SHOPIFY_SCOPES || 'read_products,write_products,read_inventory,write_inventory,read_orders,write_orders';
    const redirectUri = process.env.REDIRECT_URI;

    const authorizeUrl = `https://${normalizedUrl}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    res.json({ authUrl: authorizeUrl });
  } catch (error) {
    console.error('Error initiating Shopify connection:', error);
    res.status(500).json({ error: 'Failed to initiate Shopify connection' });
  }
});

// Shopify OAuth callback
router.get('/callback/shopify', async (req, res) => {
  const { code, shop, error, error_description } = req.query;
  
  // Handle user cancellation or errors from Shopify
  if (error) {
    const errorMsg = error_description || error;
    console.error('Shopify OAuth error:', errorMsg);
    return res.redirect(`/?shopify_error=${encodeURIComponent(errorMsg)}`);
  }

  if (!code || !shop) {
    console.error('Missing OAuth parameters');
    return res.redirect('/?shopify_error=Missing authorization parameters');
  }

  try {
    // Check if connection already exists with a token (might be from a previous successful attempt)
    const existingConnection = await prisma.connection.findFirst({
      where: {
        platform: 'shopify',
        storeUrl: shop
      }
    });

    // If connection exists with a valid token, this might be a duplicate callback
    if (existingConnection && existingConnection.accessToken) {
      console.log(`Connection already exists for ${shop}, skipping token exchange`);
      return res.redirect(`/?shopify_success=true&store=${encodeURIComponent(shop)}&webhooks=existing`);
    }

    // Exchange code for access token
    const tokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      code,
    });

    const accessToken = tokenResponse.data.access_token;

    if (existingConnection) {
      // Update existing connection
      await prisma.connection.update({
        where: { id: existingConnection.id },
        data: { accessToken, lastSync: new Date() }
      });
      console.log(`Updated Shopify connection for ${shop}`);
    } else {
      // Create new connection
      await prisma.connection.create({
        data: {
          platform: 'shopify',
          storeUrl: shop,
          accessToken
        }
      });
      console.log(`Created new Shopify connection for ${shop}`);
    }

    // Register webhooks
    let webhookStatus = 'failed';
    try {
      await registerShopifyWebhooks(shop, accessToken);
      console.log(`Registered webhooks for ${shop}`);
      webhookStatus = 'success';
    } catch (webhookError) {
      console.error('Webhook registration failed:', webhookError.message);
      // Don't fail the connection if webhooks fail
      webhookStatus = 'partial';
    }

    // Redirect to frontend with success message and webhook status
    res.redirect(`/?shopify_success=true&store=${encodeURIComponent(shop)}&webhooks=${webhookStatus}`);
  } catch (error) {
    console.error('Shopify connection error:', error.response?.data || error.message);
    
    // If it's an invalid_request error (code already used), check if we have a connection
    if (error.response?.data?.error === 'invalid_request') {
      const existingConnection = await prisma.connection.findFirst({
        where: { platform: 'shopify', storeUrl: shop }
      });
      
      if (existingConnection && existingConnection.accessToken) {
        console.log('Code already used but connection exists, treating as success');
        return res.redirect(`/?shopify_success=true&store=${encodeURIComponent(shop)}&webhooks=existing`);
      }
    }
    
    const errorMsg = error.response?.data?.error_description || error.message || 'Failed to connect Shopify store';
    res.redirect(`/?shopify_error=${encodeURIComponent(errorMsg)}`);
  }
});

// Shopify webhook endpoint
router.post('/webhook/shopify', bodyParser.raw({ type: 'application/json' }), (req, res) => {
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const topic = req.headers['x-shopify-topic'];
  const shop = req.headers['x-shopify-shop-domain'];

  const generatedHmac = crypto.createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET)
    .update(req.body)
    .digest('base64');

  if (generatedHmac !== hmac) return res.status(401).send('Invalid HMAC');

  const data = JSON.parse(req.body.toString());
  processStoreToProkip(shop, topic, data, 'shopify');

  res.status(200).send('OK');
});

// WooCommerce connection
router.post('/woocommerce', [
  body('storeUrl').isURL(),
  body('consumerKey').notEmpty(),
  body('consumerSecret').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { storeUrl, consumerKey, consumerSecret } = req.body;

  try {
    // Check if connection already exists
    const existingConnection = await prisma.connection.findFirst({
      where: {
        platform: 'woocommerce',
        storeUrl
      }
    });

    if (existingConnection) {
      // Update existing connection
      await prisma.connection.update({
        where: { id: existingConnection.id },
        data: { consumerKey, consumerSecret }
      });
    } else {
      // Create new connection
      await prisma.connection.create({
        data: {
          platform: 'woocommerce',
          storeUrl,
          consumerKey,
          consumerSecret
        }
      });
    }

    await registerWooWebhooks(storeUrl, consumerKey, consumerSecret);
    res.json({ success: true });
  } catch (error) {
    console.error('WooCommerce connection error:', error);
    res.status(500).json({ error: 'Failed to connect WooCommerce' });
  }
});

// WooCommerce webhook
router.post('/webhook/woocommerce', (req, res) => {
  const data = req.body;
  const storeUrl = data.resource?.site_url || ''; // Adjust based on actual payload
  const topic = data.topic || 'order.created';

  processStoreToProkip(storeUrl, topic, data, 'woocommerce');
  res.status(200).send('OK');
});

// Set Prokip token & location
router.post('/prokip', [
  body('token').notEmpty(),
  body('locationId').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { token, locationId } = req.body;

  await prisma.prokipConfig.upsert({
    where: { id: 1 },
    update: { token, locationId },
    create: { id: 1, token, apiUrl: process.env.PROKIP_API, locationId }
  });

  res.json({ success: true });
});

// Get connections status with enhanced data for dashboard
router.get('/status', async (req, res) => {
  try {
    const connections = await prisma.connection.findMany();

    // Enhance connections with real-time data from stores
    const enhancedConnections = await Promise.all(connections.map(async (conn) => {
      let productCount = 0;
      let orderCount = 0;

      try {
        if (conn.platform === 'shopify') {
          const [products, orders] = await Promise.all([
            getShopifyProducts(conn.storeUrl, conn.accessToken),
            getShopifyOrders(conn.storeUrl, conn.accessToken)
          ]);
          productCount = products.length;
          orderCount = orders.length;
        } else if (conn.platform === 'woocommerce') {
          const [products, orders] = await Promise.all([
            getWooProducts(conn.storeUrl, conn.consumerKey, conn.consumerSecret),
            getWooOrders(conn.storeUrl, conn.consumerKey, conn.consumerSecret)
          ]);
          productCount = products.length;
          orderCount = orders.length;
        }
      } catch (error) {
        console.error(`Failed to fetch data for ${conn.platform} store ${conn.storeUrl}:`, error.message);
        // Keep counts at 0 if fetch fails
      }

      return {
        id: conn.id,
        platform: conn.platform,
        storeUrl: conn.storeUrl,
        lastSync: conn.lastSync,
        syncEnabled: conn.syncEnabled,
        productCount,
        orderCount
      };
    }));

    res.json(enhancedConnections);
  } catch (error) {
    console.error('Error fetching connection status:', error);
    res.status(500).json({ error: 'Failed to fetch connection status' });
  }
});

// Disconnect store
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.connection.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// Update connection settings (e.g., default location)
router.patch('/:id/settings', [
  body('defaultLocationId').optional()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { id } = req.params;
  const { defaultLocationId } = req.body;

  try {
    await prisma.connection.update({
      where: { id: parseInt(id) },
      data: { defaultLocationId }
    });
    res.json({ success: true, message: 'Connection settings updated' });
  } catch (error) {
    console.error('Failed to update connection settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Disconnect store
router.delete('/:id', async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id);
    
    // Delete all related data
    await prisma.inventoryCache.deleteMany({ where: { connectionId } });
    await prisma.salesLog.deleteMany({ where: { connectionId } });
    await prisma.syncError.deleteMany({ where: { connectionId } });
    await prisma.connection.delete({ where: { id: connectionId } });
    
    res.json({ success: true, message: 'Store disconnected successfully' });
  } catch (error) {
    console.error('Failed to disconnect store:', error);
    res.status(500).json({ error: 'Failed to disconnect store' });
  }
});

module.exports = router;
