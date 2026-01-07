const axios = require('axios');
const OAuth = require('oauth').OAuth;
require('dotenv').config();
const { updateShopifyInventory, getShopifyLocations, getShopifyBaseUrl } = require('./shopifyService');
const { getWooBaseUrl } = require('./wooService');
const wooOAuthService = require('./wooOAuthService');
const wooAppPasswordService = require('./wooAppPasswordService');

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
    
    // Try application password first, then OAuth, then legacy credentials
    if (connection.wooUsername && connection.wooAppPassword) {
      // Use application password authentication
      const client = wooAppPasswordService.createAuthenticatedClient(
        connection.storeUrl, 
        connection.wooUsername, 
        connection.wooAppPassword
      );
      await client.post('products', {
        name: product.name,
        sku: product.sku,
        regular_price: product.price.toString()
      });
    } else if (connection.accessToken && connection.accessTokenSecret) {
      // Use OAuth authentication
      const client = wooOAuthService.createAuthenticatedClient(
        connection.storeUrl, 
        connection.accessToken, 
        connection.accessTokenSecret
      );
      await client.post('products', {
        name: product.name,
        sku: product.sku,
        regular_price: product.price.toString()
      });
    } else {
      // Use legacy consumer key/secret authentication
      const consumerKey = connection.consumerKey || process.env.WOO_CONSUMER_KEY;
      const consumerSecret = connection.consumerSecret || process.env.WOO_CONSUMER_SECRET;

      if (!consumerKey || !consumerSecret) {
        throw new Error('WooCommerce credentials are not configured.');
      }

      const oa = new OAuth(null, null, consumerKey, consumerSecret, '1.0A', null, 'HMAC-SHA1');
      await new Promise((resolve, reject) => {
        oa.post(
          `${baseUrl}/wp-json/wc/v3/products`,
          consumerKey,
          consumerSecret,
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
      // Try application password first, then OAuth, then legacy credentials
      if (connection.wooUsername && connection.wooAppPassword) {
        // Use application password authentication
        const client = wooAppPasswordService.createAuthenticatedClient(
          connection.storeUrl, 
          connection.wooUsername, 
          connection.wooAppPassword
        );
        
        // Find product by SKU
        const productsResponse = await client.get('products', { sku });
        const products = productsResponse.data;
        if (products.length === 0) throw new Error('Product not found');
        
        const productId = products[0].id;
        await client.put(`products/${productId}`, { stock_quantity: quantity });
      } else if (connection.accessToken && connection.accessTokenSecret) {
        // Use OAuth authentication
        const client = wooOAuthService.createAuthenticatedClient(
          connection.storeUrl, 
          connection.accessToken, 
          connection.accessTokenSecret
        );
        
        // Find product by SKU
        const productsResponse = await client.get('products', { sku });
        const products = productsResponse.data;
        if (products.length === 0) throw new Error('Product not found');
        
        const productId = products[0].id;
        await client.put(`products/${productId}`, { stock_quantity: quantity });
      } else {
        // Use legacy consumer key/secret authentication
        const baseUrl = getWooBaseUrl(connection.storeUrl);
        const consumerKey = connection.consumerKey || process.env.WOO_CONSUMER_KEY;
        const consumerSecret = connection.consumerSecret || process.env.WOO_CONSUMER_SECRET;

        if (!consumerKey || !consumerSecret) {
          throw new Error('WooCommerce credentials are not configured.');
        }

        const oa = new OAuth(null, null, consumerKey, consumerSecret, '1.0A', null, 'HMAC-SHA1');
        await new Promise((resolve, reject) => {
          oa.get(
            `${baseUrl}/wp-json/wc/v3/products?sku=${sku}`,
            consumerKey,
            consumerSecret,
            (error, data) => {
              if (error) return reject(error);
              const products = JSON.parse(data);
              if (products.length === 0) return reject(new Error('Product not found'));

              const productId = products[0].id;
              oa.put(
                `${baseUrl}/wp-json/wc/v3/products/${productId}`,
                consumerKey,
                consumerSecret,
                JSON.stringify({ stock_quantity: quantity }),
                'application/json',
                (error) => error ? reject(error) : resolve()
              );
            }
          );
        });
      }
    } catch (error) {
      console.error('WooCommerce inventory update failed:', error.message);
    }
  }
}

async function verifyWooCommerceConnection(connection) {
  const storeUrl = connection.storeUrl;
  
  // Try application password first, then OAuth, then legacy credentials
  if (connection.wooUsername && connection.wooAppPassword) {
    // Use application password authentication
    const isValid = await wooAppPasswordService.testConnection(
      storeUrl, 
      connection.wooUsername, 
      connection.wooAppPassword
    );
    if (!isValid) {
      throw new Error('Application password credentials are invalid');
    }
    return true;
  } else if (connection.accessToken && connection.accessTokenSecret) {
    // Use OAuth authentication
    const isValid = await wooOAuthService.validateAccessToken(
      storeUrl, 
      connection.accessToken, 
      connection.accessTokenSecret
    );
    if (!isValid) {
      throw new Error('OAuth credentials are invalid');
    }
    return true;
  } else {
    // Use legacy consumer key/secret authentication
    const baseUrl = getWooBaseUrl(storeUrl);
    const consumerKey = connection.consumerKey || process.env.WOO_CONSUMER_KEY;
    const consumerSecret = connection.consumerSecret || process.env.WOO_CONSUMER_SECRET;

    if (!consumerKey || !consumerSecret) {
      throw new Error('WooCommerce credentials are not configured.');
    }

    const oa = new OAuth(null, null, consumerKey, consumerSecret, '1.0A', null, 'HMAC-SHA1');
    return new Promise((resolve, reject) => {
      oa.get(
        `${baseUrl}/wp-json/wc/v3/products?per_page=1`,
        consumerKey,
        consumerSecret,
        (error, data) => {
          if (error) return reject(new Error('Failed to connect to WooCommerce. Check Store URL and credentials.'));
          resolve(true);
        }
      );
    });
  }
}

module.exports = { createProductInStore, updateInventoryInStore, verifyWooCommerceConnection };
