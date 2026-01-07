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
 */
const getWooClient = (storeUrl, key, secret) => {
  const baseURL = `${getWooBaseUrl(storeUrl)}/wp-json/wc/v3/`;

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
 */
async function registerWooWebhooks(storeUrl, consumerKey, consumerSecret) {
  const client = getWooClient(storeUrl, consumerKey, consumerSecret);
  const webhookUrl =
    process.env.WEBHOOK_URL ||
    `http://localhost:${process.env.PORT || 3000}/connections/webhook/woocommerce`;

  try {
    // Try to list webhooks (may fail due to permissions)
    const { data: webhooks } = await client.get('webhooks');
    const exists = webhooks.find(
      w => w.delivery_url === webhookUrl && w.topic === 'order.created'
    );
    if (exists) return;
  } catch (err) {
    console.warn('Skipping webhook existence check (permission limited)');
  }

  try {
    await client.post('webhooks', {
      name: 'Prokip Order Sync',
      topic: 'order.created',
      delivery_url: webhookUrl,
      secret: process.env.WOO_WEBHOOK_SECRET || 'prokip_secret'
    });

    console.log(`WooCommerce webhook registered for ${storeUrl}`);
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
 */
async function getWooProducts(storeUrl, consumerKey, consumerSecret) {
  const client = getWooClient(storeUrl, consumerKey, consumerSecret);

  try {
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
 */
async function getWooOrders(storeUrl, consumerKey, consumerSecret, after = null) {
  const client = getWooClient(storeUrl, consumerKey, consumerSecret);

  const params = {
    status: 'completed',
    per_page: 100
  };
  if (after) params.after = after;

  try {
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
