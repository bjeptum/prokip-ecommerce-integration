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
 * Helper to create a WooCommerce Axios client
 * Uses the credentials passed from the database connection
 */
const getWooClient = (storeUrl, key, secret) => {
  const baseURL = getWooBaseUrl(storeUrl) + '/wp-json/wc/v3/';
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');

  return axios.create({
    baseURL,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Prokip-Integration/1.0'
    }
  });
};

/**
 * Register WooCommerce webhooks
 */
async function registerWooWebhooks(storeUrl, consumerKey, consumerSecret) {
  try {
    const client = getWooClient(storeUrl, consumerKey, consumerSecret);
    const webhookUrl = process.env.WEBHOOK_URL || `http://localhost:${process.env.PORT || 3000}/connections/webhook/woocommerce`;
    
    // Check if webhook already exists to avoid duplicates
    try {
      const { data: webhooks } = await client.get('webhooks');
      const exists = webhooks.find(w => w.delivery_url === webhookUrl && w.topic === 'order.created');
      if (exists) return;
    } catch (e) {
      // Proceed to create if listing fails or empty
    }
    
    await client.post('webhooks', {
        name: 'Prokip Order Sync',
        topic: 'order.created',
        delivery_url: webhookUrl,
        secret: process.env.WOO_WEBHOOK_SECRET || 'prokip_secret'
    });
    console.log(`WooCommerce webhook registered for ${storeUrl}`);
  } catch (error) {
    console.error(`Error registering Woo webhook for ${storeUrl}:`, error.response?.data || error.message);
  }
}

/**
 * Fetch products
 */
async function getWooProducts(storeUrl, consumerKey, consumerSecret) {
  try {
    const client = getWooClient(storeUrl, consumerKey, consumerSecret);
    const response = await client.get('products', { params: { per_page: 100 } });
    return response.data;
  } catch (error) {
    console.error(`Error fetching Woo products from ${storeUrl}:`, error.response?.data || error.message);
    return [];
  }
}

/**
 * Fetch completed orders
 */
async function getWooOrders(storeUrl, consumerKey, consumerSecret, after = null) {
  try {
    const client = getWooClient(storeUrl, consumerKey, consumerSecret);
    const params = { status: 'completed', per_page: 100 };
    if (after) params.after = after;
    
    const response = await client.get('orders', { params });
    return response.data;
  } catch (error) {
    console.error(`Error fetching Woo orders from ${storeUrl}:`, error.response?.data || error.message);
    return [];
  }
}

module.exports = {
  registerWooWebhooks,
  getWooProducts,
  getWooOrders,
  getWooBaseUrl,
  createWooProduct: async () => { throw new Error('Use storeService'); },
  updateWooInventory: async () => { throw new Error('Use storeService'); }
};
