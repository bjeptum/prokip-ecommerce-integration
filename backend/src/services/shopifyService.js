const axios = require('axios');

const MOCK_SHOPIFY = process.env.MOCK_SHOPIFY === 'true';
const getShopifyBaseUrl = (shop) => {
  if (MOCK_SHOPIFY) {
    return process.env.MOCK_SHOPIFY_URL || 'http://localhost:4001';
  }
  return `https://${shop}`;
};

async function registerShopifyWebhooks(shop, accessToken) {
  const webhookUrl = process.env.WEBHOOK_URL || `http://localhost:${process.env.PORT}/webhook/shopify`;
  
  // Register product and inventory webhooks only
  // Note: Order webhooks (orders/create, orders/paid, orders/cancelled, orders/updated)
  // require Protected Customer Data access approval from Shopify
  // See: https://shopify.dev/docs/apps/launch/protected-customer-data
  const topics = [
    'products/update', 
    'products/create', 
    'inventory_levels/update'
  ];

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
    console.log(`🔍 Shopify API call: ${baseUrl}/admin/api/2026-01/products.json`);
    console.log(`🔑 Access token present: ${accessToken ? 'Yes' : 'No'}`);
    
    const response = await axios.get(`${baseUrl}/admin/api/2026-01/products.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    });
    
    console.log(`📦 Shopify response: ${response.data?.products?.length || 0} products`);
    return response.data.products;
  } catch (error) {
    const message = error.response?.data?.errors || error.message;
    console.error('❌ Failed to get Shopify products:', message);
    console.error('   Status:', error.response?.status);
    console.error('   Data:', JSON.stringify(error.response?.data || {}));
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

/**
 * Enable inventory tracking for a Shopify inventory item
 */
async function enableInventoryTracking(shop, accessToken, inventoryItemId) {
  try {
    const baseUrl = getShopifyBaseUrl(shop);
    await axios.put(`${baseUrl}/admin/api/2026-01/inventory_items/${inventoryItemId}.json`, {
      inventory_item: {
        id: inventoryItemId,
        tracked: true
      }
    }, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    });
    return true;
  } catch (error) {
    console.error('Failed to enable inventory tracking:', error.response?.data || error.message);
    return false;
  }
}

async function updateShopifyInventory(shop, accessToken, inventoryItemId, locationId, available) {
  try {
    const baseUrl = getShopifyBaseUrl(shop);
    
    // First, try to set the inventory level
    try {
      await axios.post(`${baseUrl}/admin/api/2026-01/inventory_levels/set.json`, {
        location_id: locationId,
        inventory_item_id: inventoryItemId,
        available
      }, {
        headers: { 'X-Shopify-Access-Token': accessToken }
      });
    } catch (invError) {
      // Check if error is about inventory tracking not being enabled
      const errorMsg = JSON.stringify(invError.response?.data?.errors || '');
      if (errorMsg.includes('tracking') || errorMsg.includes('tracked')) {
        console.log(`Enabling inventory tracking for item ${inventoryItemId}...`);
        
        // Enable inventory tracking
        const trackingEnabled = await enableInventoryTracking(shop, accessToken, inventoryItemId);
        if (!trackingEnabled) {
          throw new Error('Failed to enable inventory tracking');
        }
        
        // Retry setting inventory level
        await axios.post(`${baseUrl}/admin/api/2026-01/inventory_levels/set.json`, {
          location_id: locationId,
          inventory_item_id: inventoryItemId,
          available
        }, {
          headers: { 'X-Shopify-Access-Token': accessToken }
        });
        console.log(`✓ Inventory tracking enabled and level set for item ${inventoryItemId}`);
      } else {
        throw invError;
      }
    }
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
    const errorDetails = error.response?.data || error.message;
    console.error('Failed to get Shopify orders:', errorDetails);
    console.error('Error status:', error.response?.status);
    console.error('Shop:', shop);
    console.error('Access token present:', !!accessToken);
    throw error; // Throw original error for better debugging
  }
}

module.exports = { 
  registerShopifyWebhooks, 
  getShopifyProducts, 
  createShopifyProduct, 
  updateShopifyInventory, 
  getShopifyLocations,
  getShopifyOrders,
  getShopifyBaseUrl
};
