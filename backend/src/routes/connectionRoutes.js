const bodyParser = require('body-parser');

const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { body, query, validationResult } = require('express-validator');
const authMiddleware = require('../middlewares/authMiddleware');

const { registerShopifyWebhooks } = require('../services/shopifyService');
const { registerWooWebhooks } = require('../services/wooService');
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
], authMiddleware, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const userId = req.userId;
  const { store } = req.query;

  // Check if user has Prokip credentials
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.prokipToken) {
    return res.status(400).json({
      error: 'Prokip authentication required',
      message: 'Please log in with your Prokip credentials first'
    });
  }

  // Check if user already has a connection (only one platform allowed)
  const existingConnection = await prisma.connection.findFirst({
    where: { userId }
  });

  if (existingConnection && existingConnection.platform !== 'shopify') {
    return res.status(400).json({
      error: 'Platform already connected',
      message: `You already have a ${existingConnection.platform} connection. Please disconnect it first to connect Shopify.`
    });
  }

  // Include userId in state for callback
  const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64');
  const scopes =
    'read_products,write_products,read_inventory,write_inventory,read_orders,write_orders';

  const redirectUri =
    process.env.REDIRECT_URI ||
    `http://localhost:${process.env.PORT}/connections/callback/shopify`;

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
    // Exchange code for access token
    const tokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      code,
    });

    const accessToken = tokenResponse.data.access_token;
    
    // Extract userId from state if provided
    let userId = null;
    if (req.query.state) {
      try {
        const stateData = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
        userId = stateData.userId;
      } catch (e) {
        console.warn('Could not parse state parameter:', e);
      }
    }

    // If userId is available, use it; otherwise create connection without userId
    if (userId) {
      // Check if user already has a different platform connection
      const existingConnection = await prisma.connection.findFirst({
        where: { userId }
      });

      if (existingConnection && existingConnection.platform !== 'shopify') {
        return res.redirect(`/?error=${encodeURIComponent('You already have a ' + existingConnection.platform + ' connection. Please disconnect it first.')}`);
      }

      const connection = await prisma.connection.upsert({
        where: {
          userId_platform_storeUrl: {
            userId,
            platform: 'shopify',
            storeUrl: shop
          }
        },
        update: {
          accessToken,
          lastSync: new Date(),
          syncEnabled: true
        },
        create: {
          userId,
          platform: 'shopify',
          storeUrl: shop,
          accessToken,
          syncEnabled: true
        }
      });
    } else {
      // Legacy: create connection without userId (for backward compatibility)
      const connection = await prisma.connection.upsert({
        where: {
          platform_storeUrl: {
            platform: 'shopify',
            storeUrl: shop
          }
        },
        update: {
          accessToken,
          lastSync: new Date(),
          syncEnabled: true
        },
        create: {
          platform: 'shopify',
          storeUrl: shop,
          accessToken,
          syncEnabled: true
        }
      });
    }

    await registerShopifyWebhooks(shop, accessToken);

    res.redirect('/?success=Shopify+connected');
  } catch (error) {
    console.error('Shopify connection error:', error.response?.data || error.message);
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
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { storeUrl } = req.body;
  const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY;
  const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    return res.status(500).json({ error: 'WooCommerce credentials are not configured in .env' });
  }

  const userId = req.userId;

  try {
    // Check if user has Prokip credentials
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.prokipToken) {
      return res.status(400).json({
        error: 'Prokip authentication required',
        message: 'Please log in with your Prokip credentials first'
      });
    }

    // Check if user already has a connection (only one platform allowed)
    const existingConnection = await prisma.connection.findFirst({
      where: { userId }
    });

    if (existingConnection && existingConnection.platform !== 'woocommerce') {
      return res.status(400).json({
        error: 'Platform already connected',
        message: `You already have a ${existingConnection.platform} connection. Please disconnect it first to connect WooCommerce.`
      });
    }

    // Normalize store URL before saving
    const normalizedStoreUrl = storeUrl.trim().replace(/\/+$/, '');
    if (!normalizedStoreUrl.match(/^https?:\/\//)) {
      return res.status(400).json({
        error: 'Invalid store URL',
        message: 'Store URL must include http:// or https://'
      });
    }

    // Validate Woo credentials
    await registerWooWebhooks(normalizedStoreUrl, consumerKey, consumerSecret);

    await prisma.connection.upsert({
      where: {
        userId_platform_storeUrl: {
          userId,
          platform: 'woocommerce',
          storeUrl: normalizedStoreUrl
        }
      },
      update: {
        consumerKey,
        consumerSecret,
        lastSync: new Date(),
        syncEnabled: true
      },
      create: {
        userId,
        platform: 'woocommerce',
        storeUrl: normalizedStoreUrl,
        consumerKey,
        consumerSecret,
        syncEnabled: true
      }
    });

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
  const userId = req.userId;
  
  // Get user info to check Prokip auth
  const user = await prisma.user.findUnique({ 
    where: { id: userId },
    select: { 
      id: true, 
      prokipToken: true, 
      prokipLocationId: true,
      username: true
    }
  });

  const connections = await prisma.connection.findMany({
    where: { userId },
    select: {
      id: true,
      platform: true,
      storeUrl: true,
      lastSync: true,
      syncEnabled: true
    }
  });

  res.json({
    user: {
      id: user?.id,
      hasProkipAuth: !!user?.prokipToken,
      locationId: user?.prokipLocationId
    },
    connections,
    canConnect: !!user?.prokipToken && connections.length === 0
  });
});

/* ======================================================
   DISCONNECT STORE
====================================================== */
router.post('/disconnect', [
  body('connectionId').isInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const userId = req.userId;
  const { connectionId } = req.body;

  try {
    // Verify the connection belongs to the user
    const connection = await prisma.connection.findUnique({
      where: { id: parseInt(connectionId, 10) }
    });

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    if (connection.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized: This connection does not belong to you' });
    }

    await prisma.connection.delete({
      where: { id: parseInt(connectionId, 10) }
    });

    res.json({ success: true, message: 'Connection disconnected successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

module.exports = router;
