const axios = require('axios');

/**
 * Mock support
 */
const MOCK_WOO = process.env.MOCK_WOO === 'true';

const getWooBaseUrl = (storeUrl) => {
  if (MOCK_WOO) {
    return process.env.MOCK_WOO_URL || 'http://localhost:4002';
  }

  let baseURL = storeUrl.trim();
  if (!baseURL.startsWith('http')) {
    baseURL = `https://${baseURL}`;
  }

  return baseURL.replace(/\/$/, '');
};

/**
 * Create WooCommerce Axios client
 * ✅ DB credentials FIRST, ENV fallback SECOND
 * Supports both OAuth and Basic Auth
 */
const getWooClient = (storeUrl, key = null, secret = null, accessToken = null, accessTokenSecret = null) => {
  const baseURL = `${getWooBaseUrl(storeUrl)}/wp-json/wc/v3/`;

  // OAuth authentication takes priority
  if (accessToken && accessTokenSecret) {
    // For OAuth, we need to use the OAuth service
    const wooOAuthService = require('./wooOAuthService');
    return wooOAuthService.createAuthenticatedClient(storeUrl, accessToken, accessTokenSecret);
  }

  // Fall back to Basic Auth with consumer key/secret
  const consumerKey = key || process.env.WOO_CONSUMER_KEY;
  const consumerSecret = secret || process.env.WOO_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error('WooCommerce credentials missing');
  }

  return axios.create({
    baseURL,
    auth: {
      username: consumerKey,
      password: consumerSecret
    },
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Prokip-Integration/1.0'
    },
    timeout: 15000
  });
};

/**
 * Register WooCommerce webhooks
 * Supports both OAuth and Basic Auth
 */
async function registerWooWebhooks(storeUrl, consumerKey = null, consumerSecret = null, accessToken = null, accessTokenSecret = null) {
  let client;
  
  try {
    if (accessToken && accessTokenSecret) {
      // Use OAuth client
      const wooOAuthService = require('./wooOAuthService');
      client = wooOAuthService.createAuthenticatedClient(storeUrl, accessToken, accessTokenSecret);
    } else {
      // Use Basic Auth client
      client = getWooClient(storeUrl, consumerKey, consumerSecret);
    }
    
    const webhookUrl =
      process.env.WEBHOOK_URL ||
      `http://localhost:${process.env.PORT || 3000}/connections/webhook/woocommerce`;

    // Try to list webhooks (may fail due to permissions)
    try {
      const { data: webhooks } = await client.get('webhooks');
      const exists = webhooks.find(
        w => w.delivery_url === webhookUrl && w.topic === 'order.created'
      );
      if (exists) return;
    } catch (err) {
      console.warn('Skipping webhook existence check (permission limited)');
    }

    // Register multiple webhooks for comprehensive order tracking
    const webhooksToRegister = [
      {
        name: 'Prokip Order Created',
        topic: 'order.created',
        delivery_url: webhookUrl
      },
      {
        name: 'Prokip Order Updated', 
        topic: 'order.updated',
        delivery_url: webhookUrl
      },
      {
        name: 'Prokip Order Status Changed',
        topic: 'order.status_changed',
        delivery_url: webhookUrl
      }
    ];

    for (const webhook of webhooksToRegister) {
      try {
        await client.post('webhooks', {
          ...webhook,
          secret: process.env.WOO_WEBHOOK_SECRET || 'prokip_secret'
        });
        console.log(`✅ WooCommerce webhook registered: ${webhook.topic} for ${storeUrl}`);
      } catch (error) {
        // Check if webhook already exists
        if (error.response?.data?.code === 'woocommerce_webhook_exists') {
          console.log(`ℹ️ WooCommerce webhook already exists: ${webhook.topic} for ${storeUrl}`);
        } else {
          console.warn(`⚠️ Failed to register webhook ${webhook.topic}:`, error.response?.data || error.message);
        }
      }
    }
  } catch (error) {
    console.error(
      `Webhook creation failed for ${storeUrl}:`,
      error.response?.data || error.message
    );
    throw new Error('Failed to register WooCommerce webhook');
  }
}

/**
 * Fetch products
 * Supports OAuth, Basic Auth, and Application Password
 */
async function getWooProducts(storeUrl, consumerKey = null, consumerSecret = null, accessToken = null, accessTokenSecret = null, username = null, appPassword = null) {
  let client;
  
  try {
    if (accessToken && accessTokenSecret) {
      // Use OAuth client
      const wooOAuthService = require('./wooOAuthService');
      client = wooOAuthService.createAuthenticatedClient(storeUrl, accessToken, accessTokenSecret);
    } else if (username && appPassword) {
      // Use Application Password client
      const wooAppPasswordService = require('./wooAppPasswordService');
      client = wooAppPasswordService.createAuthenticatedClient(storeUrl, username, appPassword);
    } else {
      // Use Basic Auth client (Consumer Key/Secret)
      client = getWooClient(storeUrl, consumerKey, consumerSecret);
    }
    
    const { data } = await client.get('products', {
      params: { per_page: 100 }
    });
    return data;
  } catch (error) {
    console.error(
      `Woo products fetch failed (${storeUrl}):`,
      error.response?.data || error.message
    );
    throw new Error('Failed to fetch Woo products');
  }
}

/**
 * Fetch completed orders
 * Supports both OAuth and Basic Auth
 */
async function getWooOrders(storeUrl, consumerKey = null, consumerSecret = null, accessToken = null, accessTokenSecret = null, username = null, appPassword = null, after = null) {
  let client;
  
  try {
    if (accessToken && accessTokenSecret) {
      // Use OAuth client
      const wooOAuthService = require('./wooOAuthService');
      client = wooOAuthService.createAuthenticatedClient(storeUrl, accessToken, accessTokenSecret);
    } else if (username && appPassword) {
      // Use Application Password client
      const wooAppPasswordService = require('./wooAppPasswordService');
      client = wooAppPasswordService.createAuthenticatedClient(storeUrl, username, appPassword);
    } else {
      // Use Basic Auth client (Consumer Key/Secret)
      client = getWooClient(storeUrl, consumerKey, consumerSecret);
    }
    
    const params = {
      status: ['completed', 'processing', 'pending', 'on-hold'], // Include more order statuses
      per_page: 100
    };
    if (after) params.after = after;

    const { data } = await client.get('orders', { params });
    return data;
  } catch (error) {
    console.error(
      `Woo orders fetch failed (${storeUrl}):`,
      error.response?.data || error.message
    );
    throw new Error('Failed to fetch Woo orders');
  }
}

module.exports = {
  registerWooWebhooks,
  getWooProducts,
  getWooOrders,
  getWooBaseUrl
};
