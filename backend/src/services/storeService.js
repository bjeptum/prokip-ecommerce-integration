const axios = require('axios');
const OAuth = require('oauth').OAuth;
require('dotenv').config();
const { updateShopifyInventory, getShopifyLocations, getShopifyBaseUrl } = require('./shopifyService');
const { getWooBaseUrl } = require('./wooService');
const wooOAuthService = require('./wooOAuthService');
const wooAppPasswordService = require('./wooAppPasswordService');
const wooSecureService = require('./wooSecureService');

/**
 * Helper function to decrypt Consumer Key/Secret if encrypted
 */
function decryptCredentials(connection) {
  let consumerKey = connection.consumerKey;
  let consumerSecret = connection.consumerSecret;
  
  // Check if credentials are encrypted (they will be JSON objects with "encrypted" field)
  if (consumerKey && typeof consumerKey === 'string' && consumerKey.startsWith('{"encrypted":')) {
    try {
      const encryptedData = JSON.parse(consumerKey);
      consumerKey = wooSecureService.decrypt(encryptedData);
      console.log(' Consumer Key decrypted successfully');
    } catch (error) {
      console.error(' Failed to decrypt Consumer Key:', error.message);
      throw new Error('Failed to decrypt Consumer Key');
    }
  }
  
  if (consumerSecret && typeof consumerSecret === 'string' && consumerSecret.startsWith('{"encrypted":')) {
    try {
      const encryptedData = JSON.parse(consumerSecret);
      consumerSecret = wooSecureService.decrypt(encryptedData);
      console.log(' Consumer Secret decrypted successfully');
    } catch (error) {
      console.error(' Failed to decrypt Consumer Secret:', error.message);
      throw new Error('Failed to decrypt Consumer Secret');
    }
  }
  
  return { consumerKey, consumerSecret };
}

async function createOrUpdateProductInStore(connection, product) {
  console.log(`Creating/updating product in ${connection.platform} store:`, product);
  
  if (connection.platform === 'shopify') {
    const baseUrl = getShopifyBaseUrl(connection.storeUrl);
    
    // First try to find existing product by SKU
    try {
      const searchResponse = await axios.get(`${baseUrl}/admin/api/2026-01/products.json?limit=1&fields=id,variants`, {
        headers: { 'X-Shopify-Access-Token': connection.accessToken },
        params: { 'variant.sku': product.sku }
      });
      
      if (searchResponse.data.products.length > 0) {
        // Update existing product
        const existingProduct = searchResponse.data.products[0];
        await axios.put(`${baseUrl}/admin/api/2026-01/products/${existingProduct.id}.json`, {
          product: {
            id: existingProduct.id,
            title: product.title,
            variants: [{ id: existingProduct.variants[0].id, sku: product.sku, price: product.price }]
          }
        }, {
          headers: { 'X-Shopify-Access-Token': connection.accessToken }
        });
        console.log(`Updated Shopify product: ${product.sku}`);
      } else {
        // Create new product
        await axios.post(`${baseUrl}/admin/api/2026-01/products.json`, {
          product: {
            title: product.title,
            variants: [{ sku: product.sku, price: product.price }]
          }
        }, {
          headers: { 'X-Shopify-Access-Token': connection.accessToken }
        });
        console.log(`Created Shopify product: ${product.sku}`);
      }
    } catch (error) {
      // If search fails, try to create
      await axios.post(`${baseUrl}/admin/api/2026-01/products.json`, {
        product: {
          title: product.title,
          variants: [{ sku: product.sku, price: product.price }]
        }
      }, {
        headers: { 'X-Shopify-Access-Token': connection.accessToken }
      });
    }
  } else if (connection.platform === 'woocommerce') {
    const baseUrl = getWooBaseUrl(connection.storeUrl);
    const { consumerKey, consumerSecret } = decryptCredentials(connection);
    
    console.log(`Creating/updating WooCommerce product at ${baseUrl}/wp-json/wc/v3/products`);
    
    // First try to find existing product by SKU
    try {
      const searchResponse = await axios.get(`${baseUrl}/wp-json/wc/v3/products`, {
        auth: { username: consumerKey, password: consumerSecret },
        params: { sku: product.sku, limit: 1 }
      });
      
      if (searchResponse.data.length > 0) {
        // Update existing product
        const existingProduct = searchResponse.data[0];
        const updateData = {
          name: product.name,
          regular_price: product.price.toString(),
          manage_stock: true,
          stock_quantity: product.stock_quantity || 0
        };
        
        await axios.put(`${baseUrl}/wp-json/wc/v3/products/${existingProduct.id}`, updateData, {
          auth: { username: consumerKey, password: consumerSecret },
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Prokip-Integration/1.0'
          }
        });
        console.log(`Updated WooCommerce product: ${product.sku}`);
      } else {
        // Create new product
        await createProductInStore(connection, product);
        console.log(`Created WooCommerce product: ${product.sku}`);
      }
    } catch (error) {
      // If search fails, try to create
      await createProductInStore(connection, product);
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
      if (!product) throw new Error(`Product with SKU ${sku} not found in Shopify`);

      const variant = product.variants[0]; // Assume first variant
      
      // Get location - use configured location or try to fetch locations
      let locationId = connection.defaultLocationId;
      
      if (!locationId) {
        try {
          // Try to get locations from Shopify
          const locations = await getShopifyLocations(connection.storeUrl, connection.accessToken);
          if (locations && locations.length > 0) {
            locationId = locations[0].id;
          }
        } catch (locationError) {
          // Location API requires 'read_locations' scope which may not be approved
          // Check if error is about missing scope
          const errorMsg = locationError.message || '';
          if (errorMsg.includes('read_locations') || errorMsg.includes('merchant approval')) {
            console.warn(`Shopify locations scope not approved for ${connection.storeUrl}. ` +
              `To enable inventory sync, please approve the read_locations scope in your Shopify admin, ` +
              `or configure a defaultLocationId for this connection.`);
            throw new Error('Shopify locations permission not approved. Please approve read_locations scope or configure a default location.');
          }
          throw locationError;
        }
      }
      
      if (!locationId) {
        throw new Error('No location ID available. Please configure a default location for this store.');
      }

      await updateShopifyInventory(connection.storeUrl, connection.accessToken, variant.inventory_item_id, locationId, quantity);
      return { success: true, message: `Inventory updated for SKU ${sku}` };
    } catch (error) {
      console.error('Shopify inventory update failed:', error.message);
      throw error; // Re-throw to let caller handle it
    }
  } else if (connection.platform === 'woocommerce') {
    try {
      // Use the same authentication method as createOrUpdateProductInStore
      const baseUrl = getWooBaseUrl(connection.storeUrl);
      const { consumerKey, consumerSecret } = decryptCredentials(connection);
      
      // Find product by SKU
      const searchResponse = await axios.get(`${baseUrl}/wp-json/wc/v3/products`, {
        auth: { username: consumerKey, password: consumerSecret },
        params: { sku: sku, limit: 1 }
      });
      
      if (searchResponse.data.length === 0) {
        throw new Error(`Product with SKU ${sku} not found`);
      }
      
      const productId = searchResponse.data[0].id;
      
      // Update product stock
      const updateResponse = await axios.put(`${baseUrl}/wp-json/wc/v3/products/${productId}`, {
        manage_stock: true,
        stock_quantity: quantity
      }, {
        auth: { username: consumerKey, password: consumerSecret },
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Prokip-Integration/1.0'
        }
      });
      
      console.log(`✅ WooCommerce inventory updated: SKU ${sku}, Product ID ${productId}, New Stock: ${quantity}`);
      return { success: true, message: `Inventory updated for SKU ${sku}` };
      
    } catch (error) {
      console.error('WooCommerce inventory update failed:', error.response?.data || error.message);
      console.error('Full error details:', {
        sku,
        quantity,
        errorMessage: error.message,
        responseData: error.response?.data,
        statusCode: error.response?.status
      });
      throw error;
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

async function createProductInStore(connection, product) {
  console.log(`Creating product in ${connection.platform} store:`, product);
  
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
    console.log(`Creating WooCommerce product at ${baseUrl}/wp-json/wc/v3/products`);
    
    try {
      // Try application password first, then OAuth, then legacy credentials
      if (connection.wooUsername && connection.wooAppPassword) {
        console.log('Using WooCommerce application password authentication');
        // Use application password authentication
        const client = wooAppPasswordService.createAuthenticatedClient(
          connection.storeUrl, 
          connection.wooUsername, 
          connection.wooAppPassword
        );
        const response = await client.post('products', {
          name: product.name,
          sku: product.sku,
          regular_price: product.price.toString(),
          status: 'publish',
          manage_stock: true,
          stock_quantity: product.stock_quantity || 0
        });
        console.log('WooCommerce product created successfully:', response.data);
      } else if (connection.accessToken && connection.accessTokenSecret) {
        console.log('Using WooCommerce OAuth authentication');
        // Use OAuth authentication
        const client = wooOAuthService.createAuthenticatedClient(
          connection.storeUrl, 
          connection.accessToken, 
          connection.accessTokenSecret
        );
        const response = await client.post('products', {
          name: product.name,
          sku: product.sku,
          regular_price: product.price.toString(),
          status: 'publish',
          manage_stock: true,
          stock_quantity: product.stock_quantity || 0
        });
        console.log('WooCommerce product created successfully via OAuth:', response.data);
      } else {
        console.log('Using WooCommerce legacy consumer key/secret authentication');
        // Use legacy consumer key/secret authentication
        const consumerKey = connection.consumerKey || process.env.WOO_CONSUMER_KEY;
        const consumerSecret = connection.consumerSecret || process.env.WOO_CONSUMER_SECRET;

        if (!consumerKey || !consumerSecret) {
          throw new Error('WooCommerce credentials are not configured.');
        }

        const response = await axios.post(`${baseUrl}/wp-json/wc/v3/products`, {
          name: product.name,
          sku: product.sku,
          regular_price: product.price.toString(),
          status: 'publish',
          manage_stock: true,
          stock_quantity: product.stock_quantity || 0
        }, {
          auth: {
            username: consumerKey,
            password: consumerSecret
          },
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Prokip-Integration/1.0'
          }
        });
        console.log('WooCommerce product created successfully via legacy auth:', response.data);
      }
    } catch (error) {
      console.error('WooCommerce product creation failed:', error.response?.data || error.message);
      throw new Error(`Failed to create WooCommerce product: ${error.response?.data?.message || error.message}`);
    }
  }
}

module.exports = { createProductInStore, createOrUpdateProductInStore, updateInventoryInStore, verifyWooCommerceConnection, decryptCredentials };
