const axios = require('axios');

const MOCK_MODE = process.env.MOCK_MODE === 'true';
const getShopifyBaseUrl = (shop) => {
  if (MOCK_MODE) {
    return process.env.MOCK_SHOPIFY_URL || 'http://localhost:4001';
  }
  return `https://${shop}`;
};

async function registerShopifyWebhooks(shop, accessToken) {
  const webhookUrl = process.env.WEBHOOK_URL || `http://localhost:${process.env.PORT}/connections/webhook/shopify`;
  // Only register product webhooks - order webhooks require protected customer data access
  const topics = ['products/update', 'products/create', 'inventory_levels/update'];

  // First, clean up existing webhooks with the same address
  await cleanupExistingWebhooks(shop, accessToken, webhookUrl);

  for (const topic of topics) {
    try {
      const baseUrl = getShopifyBaseUrl(shop);
      await axios.post(`${baseUrl}/admin/api/2026-01/webhooks.json`, {
        webhook: {
          topic,
          address: webhookUrl,
          format: 'json'
        }
      }, {
        headers: { 'X-Shopify-Access-Token': accessToken }
      });
      console.log(`✓ Registered ${topic} webhook successfully`);
    } catch (error) {
      console.error(`Failed to register ${topic} webhook:`, error.response?.data || error.message);
    }
  }
}

async function cleanupExistingWebhooks(shop, accessToken, webhookUrl) {
  try {
    const baseUrl = getShopifyBaseUrl(shop);
    // Get all existing webhooks
    const response = await axios.get(`${baseUrl}/admin/api/2026-01/webhooks.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    });
    const webhooks = response.data.webhooks;

    // Find and delete webhooks with the same address
    for (const webhook of webhooks) {
      if (webhook.address === webhookUrl) {
        await axios.delete(`${baseUrl}/admin/api/2026-01/webhooks/${webhook.id}.json`, {
          headers: { 'X-Shopify-Access-Token': accessToken }
        });
        console.log(`✓ Deleted existing webhook for topic: ${webhook.topic}`);
      }
    }
  } catch (error) {
    console.error('Failed to cleanup existing webhooks:', error.response?.data || error.message);
  }
}

async function getShopifyProducts(shop, accessToken) {
  try {
    const baseUrl = getShopifyBaseUrl(shop);
    const response = await axios.get(`${baseUrl}/admin/api/2026-01/products.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    });
    return response.data.products;
  } catch (error) {
    const message = error.response?.data?.errors || error.message;
    console.error('Failed to get Shopify products:', message);
    throw new Error(`Shopify API Error: ${message}`);
  }
}

async function createShopifyProduct(shop, accessToken, product) {
  try {
    const baseUrl = getShopifyBaseUrl(shop);
    const response = await axios.post(`${baseUrl}/admin/api/2026-01/products.json`, {
      product: {
        title: product.title,
        variants: [{
          sku: product.sku,
          price: product.price,
          inventory_quantity: product.stock_quantity || 0
        }]
      }
    }, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    });
    return response.data.product;
  } catch (error) {
    const message = error.response?.data?.errors || error.message;
    console.error('Failed to create Shopify product:', message);
    throw new Error(`Shopify API Error: ${message}`);
  }
}

async function updateShopifyInventory(shop, accessToken, inventoryItemId, locationId, available) {
  try {
    const baseUrl = getShopifyBaseUrl(shop);
    await axios.post(`${baseUrl}/admin/api/2026-01/inventory_levels/set.json`, {
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available
    }, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    });
  } catch (error) {
    console.error('Failed to update Shopify inventory:', error.response?.data || error.message);
    throw new Error('Unable to update inventory in Shopify');
  }
}

async function getShopifyLocations(shop, accessToken) {
  try {
    const baseUrl = getShopifyBaseUrl(shop);
    const response = await axios.get(`${baseUrl}/admin/api/2026-01/locations.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    });
    return response.data.locations;
  } catch (error) {
    console.error('Failed to get Shopify locations:', error.response?.data || error.message);
    throw new Error('Unable to fetch locations from Shopify');
  }
}

async function getShopifyOrders(shop, accessToken, limit = 50) {
  try {
    const baseUrl = getShopifyBaseUrl(shop);
    const response = await axios.get(`${baseUrl}/admin/api/2026-01/orders.json?limit=${limit}&status=any`, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    });
    return response.data.orders;
  } catch (error) {
    console.error('Failed to get Shopify orders:', error.response?.data || error.message);
    throw new Error('Unable to fetch orders from Shopify');
  }
}

module.exports = { 
  registerShopifyWebhooks, 
  getShopifyProducts, 
  createShopifyProduct, 
  updateShopifyInventory, 
  getShopifyLocations,
  getShopifyOrders
};
