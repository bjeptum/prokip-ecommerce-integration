const bodyParser = require('body-parser');

const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { body, query, validationResult } = require('express-validator');
const authMiddleware = require('../middlewares/authMiddleware');

const { registerShopifyWebhooks } = require('../services/shopifyService');
const { registerWooWebhooks } = require('../services/wooService');
const wooOAuthService = require('../services/wooOAuthService');
const wooAppPasswordService = require('../services/wooAppPasswordService');
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

    // Validate the token by making a test API call
    try {
      await axios.get(`https://${shop}/admin/api/2026-01/shop.json`, {
        headers: { 'X-Shopify-Access-Token': accessToken }
      });
      console.log(`✓ Token validated for ${shop}`);
    } catch (validationError) {
      console.error('Token validation failed:', validationError.response?.data || validationError.message);
      throw new Error('Received invalid access token from Shopify');
    }

    if (existingConnection) {
      // Update existing connection
      await prisma.connection.update({
        where: { id: existingConnection.id },
        data: { accessToken, lastSync: new Date() }
      });
      console.log(`Updated Shopify connection for ${shop}`);
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

// WooCommerce Application Password connection - simplified URL + credentials approach
router.post('/woocommerce/connect', [
  body('storeUrl').isURL().withMessage('Please provide a valid store URL'),
  body('username').notEmpty().withMessage('WordPress username is required'),
  body('password').notEmpty().withMessage('WordPress password is required')
], authMiddleware, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { storeUrl, username, password } = req.body;
    const userId = req.userId;

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

    // Normalize store URL
    const normalizedStoreUrl = storeUrl.trim().replace(/\/+$/, '');
    if (!normalizedStoreUrl.match(/^https?:\/\//)) {
      return res.status(400).json({
        error: 'Invalid store URL',
        message: 'Store URL must include http:// or https://'
      });
    }

    // Test initial connection with provided credentials
    console.log('🔍 Testing initial WooCommerce connection...');
    console.log('Store URL:', normalizedStoreUrl);
    console.log('Username:', username);
    
    const testResult = await wooAppPasswordService.testConnection(normalizedStoreUrl, username, password);
    if (!testResult) {
      console.error('❌ Initial connection test failed');
      
      // Provide detailed error information for troubleshooting
      const errorDetails = {
        storeUrl: normalizedStoreUrl,
        username: username,
        step: 'initial_test',
        troubleshooting: [
          '1. Verify your WordPress admin credentials work in WordPress admin',
          '2. Ensure WooCommerce REST API is enabled (WooCommerce → Settings → Advanced → Legacy API)',
          '3. Check if Application Passwords are allowed (WordPress 5.6+)',
          '4. Verify your store URL is correct and accessible',
          '5. Check if security plugins are blocking API access',
          '6. Ensure your user has Administrator role',
          '7. Try temporarily disabling security plugins to test'
        ],
        commonIssues: [
          'Wrong WordPress username/password',
          'WooCommerce REST API disabled',
          'Security plugin blocking requests',
          'Invalid store URL',
          'Insufficient user permissions'
        ]
      };
      
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Unable to connect to WooCommerce. Please verify your credentials and store configuration.',
        details: errorDetails
      });
    }
    console.log('✅ Initial connection test passed');

    // Create application password for future use
    let appPasswordData;
    try {
      console.log('🔐 Creating application password...');
      appPasswordData = await wooAppPasswordService.createApplicationPassword(normalizedStoreUrl, username, password);
      console.log('✅ Application password created successfully');
      console.log('Method:', appPasswordData.method);
      console.log('App Name:', appPasswordData.appName);
    } catch (appPasswordError) {
      console.error('❌ Application password creation failed:', appPasswordError.message);
      
      // Use direct credentials as fallback
      appPasswordData = {
        username: username,
        password: password,
        appName: 'Direct Credentials (Fallback)',
        created: new Date().toISOString(),
        method: 'direct_fallback'
      };
      console.log('⚠️  Using direct credentials as fallback');
    }

    // Register webhooks
    try {
      await wooAppPasswordService.registerWebhooks(normalizedStoreUrl, appPasswordData.username, appPasswordData.password);
    } catch (webhookError) {
      console.warn('Webhook registration failed (optional):', webhookError.message);
    }

    // Save connection to database
    await prisma.connection.upsert({
      where: {
        userId_platform_storeUrl: {
          userId,
          platform: 'woocommerce',
          storeUrl: normalizedStoreUrl
        }
      },
      update: {
        wooUsername: appPasswordData.username,
        wooAppPassword: appPasswordData.password,
        wooAppName: appPasswordData.appName,
        lastSync: new Date(),
        syncEnabled: true
      },
      create: {
        userId,
        platform: 'woocommerce',
        storeUrl: normalizedStoreUrl,
        wooUsername: appPasswordData.username,
        wooAppPassword: appPasswordData.password,
        wooAppName: appPasswordData.appName,
        syncEnabled: true
      }
    });

    console.log(`✅ WooCommerce connected successfully for ${normalizedStoreUrl}`);
    res.json({ 
      success: true,
      message: 'WooCommerce store connected successfully',
      storeUrl: normalizedStoreUrl,
      appName: appPasswordData.appName
    });
  } catch (error) {
    console.error('WooCommerce connection error:', error);
    res.status(500).json({ 
      error: 'Failed to connect WooCommerce',
      message: error.message 
    });
  }
});

// WooCommerce OAuth callback
router.get('/callback/woocommerce', async (req, res) => {
  const { oauth_token, oauth_verifier, state, error } = req.query;
  
  // Handle user cancellation or errors
  if (error) {
    console.error('WooCommerce OAuth error:', error);
    return res.redirect(`/?woo_error=${encodeURIComponent(error)}`);
  }

  if (!oauth_token || !oauth_verifier || !state) {
    console.error('Missing OAuth parameters');
    return res.redirect('/?woo_error=Missing authorization parameters');
  }

  try {
    // Decode state to get user info
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (parseError) {
      return res.redirect('/?woo_error=Invalid state parameter');
    }

    const { userId, storeUrl } = stateData;

    // Validate timestamp (prevent replay attacks)
    const now = Date.now();
    if (now - stateData.timestamp > 300000) { // 5 minutes
      return res.redirect('/?woo_error=Authorization expired');
    }

    // Exchange request token for access token
    const { accessToken, accessTokenSecret } = await wooOAuthService.exchangeRequestToken(
      oauth_token, 
      '', // We don't store request token secret in this implementation
      oauth_verifier,
      storeUrl
    );

    // Validate the access token
    const isValid = await wooOAuthService.validateAccessToken(storeUrl, accessToken, accessTokenSecret);
    if (!isValid) {
      throw new Error('Received invalid access token from WooCommerce');
    }

    // Normalize store URL
    const normalizedStoreUrl = storeUrl.trim().replace(/\/+$/, '');
    if (!normalizedStoreUrl.match(/^https?:\/\//)) {
      return res.redirect('/?woo_error=Invalid store URL format');
    }

    // Save connection to database
    await prisma.connection.upsert({
      where: {
        userId_platform_storeUrl: {
          userId,
          platform: 'woocommerce',
          storeUrl: normalizedStoreUrl
        }
      },
      update: {
        accessToken,
        accessTokenSecret,
        lastSync: new Date(),
        syncEnabled: true
      },
      create: {
        userId,
        platform: 'woocommerce',
        storeUrl: normalizedStoreUrl,
        accessToken,
        accessTokenSecret,
        syncEnabled: true
      }
    });

    // Register webhooks using the new OAuth client
    const client = wooOAuthService.createAuthenticatedClient(normalizedStoreUrl, accessToken, accessTokenSecret);
    try {
      await client.post('webhooks', {
        name: 'Prokip Order Sync',
        topic: 'order.created',
        delivery_url: process.env.WEBHOOK_URL || `http://localhost:${process.env.PORT || 3000}/connections/webhook/woocommerce`,
        secret: process.env.WOO_WEBHOOK_SECRET || 'prokip_secret'
      });
      console.log(`✓ WooCommerce webhook registered for ${storeUrl}`);
    } catch (webhookError) {
      console.warn('Webhook registration failed (optional):', webhookError.message);
    }

    console.log(`✓ WooCommerce OAuth connection successful for ${storeUrl}`);
    res.redirect('/?woo_success=WooCommerce+connected+successfully');
  } catch (error) {
    console.error('WooCommerce OAuth connection error:', error);
    const errorMsg = error.message || 'Failed to connect WooCommerce store';
    res.redirect(`/?woo_error=${encodeURIComponent(errorMsg)}`);
  }
});

// Legacy WooCommerce connection (for backward compatibility)
router.post('/woocommerce', [
  body('storeUrl').isURL(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { storeUrl } = req.body;
  const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY;
  const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    return res.status(500).json({ 
      error: 'Legacy WooCommerce credentials are not configured',
      message: 'Please use the new OAuth connection method or configure WOOCOMMERCE_CONSUMER_KEY and WOOCOMMERCE_CONSUMER_SECRET in .env'
    });
  }

  const userId = req.userId;

  try {
    // Validate credentials by making a test API call
    const normalizedUrl = storeUrl.replace(/\/$/, '');
    try {
      await axios.get(`${normalizedUrl}/wp-json/wc/v3/system_status`, {
        auth: { username: consumerKey, password: consumerSecret }
      });
      console.log(`✓ WooCommerce credentials validated for ${storeUrl}`);
    } catch (validationError) {
      console.error('WooCommerce validation failed:', validationError.response?.data || validationError.message);
      return res.status(401).json({ 
        error: 'Invalid WooCommerce credentials',
        message: 'The Consumer Key or Consumer Secret is incorrect. Please check your credentials and try again.'
      });
    }

    // Check if connection already exists
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
          // Use application password, OAuth tokens, or consumer key/secret
          const [products, orders] = await Promise.all([
            getWooProducts(
              conn.storeUrl, 
              conn.consumerKey, 
              conn.consumerSecret,
              conn.accessToken,
              conn.accessTokenSecret
            ),
            getWooOrders(
              conn.storeUrl, 
              conn.consumerKey, 
              conn.consumerSecret,
              conn.accessToken,
              conn.accessTokenSecret
            )
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
  const connectionId = parseInt(id);
  
  try {
    // Delete all related data first (cascade delete)
    await prisma.inventoryCache.deleteMany({ where: { connectionId } });
    await prisma.salesLog.deleteMany({ where: { connectionId } });
    await prisma.syncError.deleteMany({ where: { connectionId } });
    
    // Now delete the connection
    await prisma.connection.delete({ where: { id: connectionId } });
    
    console.log(`✓ Deleted connection ${connectionId} and all related data`);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to disconnect store:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
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
