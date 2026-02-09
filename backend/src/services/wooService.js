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
    timeout: 30000
  });
};

function isAxiosInstance(client) {
  // axios.create() returns a callable instance with a `defaults` property.
  return Boolean(client && client.defaults && typeof client.get === 'function');
}

async function clientGet(client, endpoint, params) {
  if (isAxiosInstance(client)) {
    return client.get(endpoint, { params });
  }

  // Custom clients in this codebase expose (endpoint, params) signature.
  return client.get(endpoint, params);
}

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
async function getWooProducts(
  storeUrl,
  consumerKey = null,
  consumerSecret = null,
  accessToken = null,
  accessTokenSecret = null,
  username = null,
  appPassword = null,
  options = {}
) {
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

    const perPageRaw = options?.per_page ?? options?.perPage ?? options?.limit ?? 50;
    const pageRaw = options?.page ?? 1;
    const per_page = Math.max(1, Math.min(100, parseInt(perPageRaw, 10) || 50));
    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const params = { per_page, ...(page > 1 ? { page } : {}) };

    // Support common Woo params needed by sync flows (e.g. include specific IDs).
    const includeRaw = options?.include ?? options?.includes;
    if (includeRaw) {
      params.include = Array.isArray(includeRaw) ? includeRaw.join(',') : includeRaw;
    }

    const statusRaw = options?.status;
    if (statusRaw) params.status = statusRaw;

    const skuRaw = options?.sku;
    if (skuRaw) params.sku = skuRaw;

    const searchRaw = options?.search;
    if (searchRaw) params.search = searchRaw;
    
    try {
      const response = await clientGet(client, 'products', params);
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const shouldRetryWithQueryAuth =
        !accessToken &&
        !accessTokenSecret &&
        !username &&
        !appPassword &&
        consumerKey &&
        consumerSecret &&
        (status === 401 || status === 403 || status === 400);

      // Some hosts strip the Authorization header; retry with query-string auth.
      if (shouldRetryWithQueryAuth) {
        const baseUrl = getWooBaseUrl(storeUrl);
        const { data } = await axios.get(`${baseUrl}/wp-json/wc/v3/products`, {
          params: {
            ...params,
            consumer_key: consumerKey,
            consumer_secret: consumerSecret
          },
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Prokip-Integration/1.0',
            Accept: 'application/json'
          },
          timeout: 30000
        });
        return data;
      }

      throw error;
    }
  } catch (error) {
    console.error(
      `Woo products fetch failed (${storeUrl}):`,
      error.response?.data || error.message
    );

    const status = error.response?.status;
    const serverMessage =
      error.response?.data?.message ||
      error.response?.data?.code ||
      (typeof error.response?.data === 'string' ? error.response.data : null);
    const detail = serverMessage ? ` - ${serverMessage}` : '';

    throw new Error(`Failed to fetch Woo products${status ? ` (HTTP ${status})` : ''}${detail}`);
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
      per_page: 50
    };
    if (after) params.after = after;

    try {
      const response = await clientGet(client, 'orders', params);
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const shouldRetryWithQueryAuth =
        !accessToken &&
        !accessTokenSecret &&
        !username &&
        !appPassword &&
        consumerKey &&
        consumerSecret &&
        (status === 401 || status === 403 || status === 400);

      if (shouldRetryWithQueryAuth) {
        const baseUrl = getWooBaseUrl(storeUrl);
        const { data } = await axios.get(`${baseUrl}/wp-json/wc/v3/orders`, {
          params: {
            ...params,
            consumer_key: consumerKey,
            consumer_secret: consumerSecret
          },
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Prokip-Integration/1.0',
            Accept: 'application/json'
          },
          timeout: 30000
        });
        return data;
      }

      throw error;
    }
  } catch (error) {
    console.error(
      `Woo orders fetch failed (${storeUrl}):`,
      error.response?.data || error.message
    );

    const status = error.response?.status;
    const serverMessage =
      error.response?.data?.message ||
      error.response?.data?.code ||
      (typeof error.response?.data === 'string' ? error.response.data : null);
    const detail = serverMessage ? ` - ${serverMessage}` : '';

    throw new Error(`Failed to fetch Woo orders${status ? ` (HTTP ${status})` : ''}${detail}`);
  }
}

async function testWooConnection(
  storeUrl,
  consumerKey = null,
  consumerSecret = null,
  accessToken = null,
  accessTokenSecret = null,
  username = null,
  appPassword = null
) {
  try {
    // Prefer application password path when provided
    if (username && appPassword) {
      const wooAppPasswordService = require('./wooAppPasswordService');
      const ok = await wooAppPasswordService.testConnection(storeUrl, username, appPassword);
      if (ok) {
        return { success: true, message: 'WooCommerce connection is working', storeInfo: { url: storeUrl } };
      }
      return { success: false, message: 'WooCommerce connection test failed', details: 'Application password was rejected' };
    }

    // Fallback to CK/CS or OAuth
    await getWooProducts(
      storeUrl,
      consumerKey,
      consumerSecret,
      accessToken,
      accessTokenSecret,
      username,
      appPassword,
      { per_page: 1, page: 1 }
    );

    return { success: true, message: 'WooCommerce connection is working', storeInfo: { url: storeUrl } };
  } catch (error) {
    const status = error.response?.status;
    const detail = error.response?.data?.message || error.response?.data?.error || error.message;
    return {
      success: false,
      message: 'WooCommerce connection test failed',
      details: `${detail}${status ? ` (HTTP ${status})` : ''}`
    };
  }
}

module.exports = {
  registerWooWebhooks,
  getWooProducts,
  getWooOrders,
  testWooConnection,
  getWooBaseUrl
};
