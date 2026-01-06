const axios = require('axios');
const OAuth = require('oauth').OAuth;
const { updateShopifyInventory, getShopifyLocations, getShopifyBaseUrl } = require('./shopifyService');
const { getWooBaseUrl } = require('./wooService');

async function createProductInStore(connection, product) {
  if (connection.platform === 'shopify') {
    const baseUrl = getShopifyBaseUrl(connection.storeUrl);
    await axios.post(`${baseUrl}/admin/api/2026-01/products.json`, {
      product: {
        title: product.title,
        variants: [{ sku: product.sku, price: product.price }]
      }
    }, {
      headers: { 'X-Shopify-Access-Token': connection.accessToken }
    });
  } else if (connection.platform === 'woocommerce') {
    const baseUrl = getWooBaseUrl(connection.storeUrl);
    const oa = new OAuth(null, null, connection.consumerKey, connection.consumerSecret, '1.0A', null, 'HMAC-SHA1');
    return new Promise((resolve, reject) => {
      oa.post(
        `${baseUrl}/wp-json/wc/v3/products`,
        connection.consumerKey,
        connection.consumerSecret,
        JSON.stringify({
          name: product.name,
          sku: product.sku,
          regular_price: product.price.toString()
        }),
        'application/json',
        (error) => error ? reject(error) : resolve()
      );
    });
  }
}

async function updateInventoryInStore(connection, sku, quantity) {
  if (connection.platform === 'shopify') {
    try {
      // First, find the product by SKU
      const baseUrl = getShopifyBaseUrl(connection.storeUrl);
      const productsRes = await axios.get(`${baseUrl}/admin/api/2026-01/products.json?sku=${sku}`, {
        headers: { 'X-Shopify-Access-Token': connection.accessToken }
      });
      const product = productsRes.data.products[0];
      if (!product) throw new Error('Product not found');

      const variant = product.variants[0]; // Assume first variant
      
      // Get location - use configured location or default to first
      const locations = await getShopifyLocations(connection.storeUrl, connection.accessToken);
      let locationId;
      
      if (connection.defaultLocationId) {
        // Use configured location
        locationId = connection.defaultLocationId;
      } else {
        // Default to first location
        locationId = locations[0].id;
      }

      await updateShopifyInventory(connection.storeUrl, connection.accessToken, variant.inventory_item_id, locationId, quantity);
    } catch (error) {
      console.error('Shopify inventory update failed:', error.message);
    }
  } else if (connection.platform === 'woocommerce') {
    try {
      // Find product by SKU
      const baseUrl = getWooBaseUrl(connection.storeUrl);
      const oa = new OAuth(null, null, connection.consumerKey, connection.consumerSecret, '1.0A', null, 'HMAC-SHA1');
      return new Promise((resolve, reject) => {
        oa.get(
          `${baseUrl}/wp-json/wc/v3/products?sku=${sku}`,
          connection.consumerKey,
          connection.consumerSecret,
          (error, data) => {
            if (error) return reject(error);
            const products = JSON.parse(data);
            if (products.length === 0) return reject(new Error('Product not found'));

            const productId = products[0].id;
            oa.put(
              `${baseUrl}/wp-json/wc/v3/products/${productId}`,
              connection.consumerKey,
              connection.consumerSecret,
              JSON.stringify({ stock_quantity: quantity }),
              'application/json',
              (error) => error ? reject(error) : resolve()
            );
          }
        );
      });
    } catch (error) {
      console.error('WooCommerce inventory update failed:', error.message);
    }
  }
}

module.exports = { createProductInStore, updateInventoryInStore };
