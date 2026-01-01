const axios = require('axios');

const MOCK_MODE = process.env.MOCK_MODE === 'true';
const getWooBaseUrl = (storeUrl) => {
  if (MOCK_MODE) {
    return process.env.MOCK_WOO_URL || 'http://localhost:4002';
  }
  return storeUrl;
};

async function registerWooWebhooks(storeUrl, consumerKey, consumerSecret) {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const webhookUrl = process.env.WEBHOOK_URL || `http://localhost:${process.env.PORT}/connections/webhook/woocommerce`;

  try {
    const baseUrl = getWooBaseUrl(storeUrl);
    await axios.post(`${baseUrl}/wp-json/wc/v3/webhooks`, {
      name: 'Prokip Order Sync',
      topic: 'order.created',
      delivery_url: webhookUrl,
      secret: process.env.WEBHOOK_SECRET || 'prokip-secret'
    }, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Failed to register WooCommerce webhook:', error.response?.data || error.message);
  }
}

async function getWooProducts(storeUrl, consumerKey, consumerSecret) {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  try {
    const baseUrl = getWooBaseUrl(storeUrl);
    const response = await axios.get(`${baseUrl}/wp-json/wc/v3/products`, {
      headers: { 'Authorization': `Basic ${auth}` }
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    console.error('Failed to get WooCommerce products:', message);
    throw new Error(`WooCommerce API Error: ${message}`);
  }
}

async function createWooProduct(storeUrl, consumerKey, consumerSecret, product) {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  try {
    const baseUrl = getWooBaseUrl(storeUrl);
    const response = await axios.post(`${baseUrl}/wp-json/wc/v3/products`, {
      name: product.name,
      sku: product.sku,
      regular_price: product.price.toString(),
      stock_quantity: product.stock_quantity || 0
    }, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to create WooCommerce product:', error.response?.data || error.message);
    throw new Error('Unable to create product in WooCommerce');
  }
}

async function updateWooInventory(storeUrl, consumerKey, consumerSecret, productId, quantity) {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  try {
    const baseUrl = getWooBaseUrl(storeUrl);
    await axios.put(`${baseUrl}/wp-json/wc/v3/products/${productId}`, {
      stock_quantity: quantity
    }, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Failed to update WooCommerce inventory:', error.response?.data || error.message);
    throw new Error('Unable to update inventory in WooCommerce');
  }
}

async function getWooOrders(storeUrl, consumerKey, consumerSecret, after) {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const params = after ? `?status=completed&after=${after}` : '?status=completed';
  try {
    const baseUrl = getWooBaseUrl(storeUrl);
    const response = await axios.get(`${baseUrl}/wp-json/wc/v3/orders${params}`, {
      headers: { 'Authorization': `Basic ${auth}` }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get WooCommerce orders:', error.response?.data || error.message);
    throw new Error('Unable to fetch orders from WooCommerce');
  }
}

module.exports = { 
  registerWooWebhooks, 
  getWooProducts, 
  createWooProduct, 
  updateWooInventory, 
  getWooOrders 
};
