const axios = require('axios');
const OAuth = require('oauth').OAuth;
require('dotenv').config();
const { updateShopifyInventory, getShopifyLocations, getShopifyBaseUrl } = require('./shopifyService');
const { getWooBaseUrl } = require('./wooService');
const wooOAuthService = require('./wooOAuthService');
const wooAppPasswordService = require('./wooAppPasswordService');
const wooSecureService = require('./wooSecureService');

const WOO_REQUEST_TIMEOUT_MS = Math.max(
  1000,
  parseInt(process.env.WOO_REQUEST_TIMEOUT_MS || process.env.WOO_HTTP_TIMEOUT_MS || '30000', 10) || 30000
);

function shouldRetryWooWithQueryAuth(error) {
  const status = error?.response?.status;
  return status === 400 || status === 401 || status === 403;
}

async function wooGetWithFallback(url, consumerKey, consumerSecret, params) {
  try {
    return await axios.get(url, {
      auth: { username: consumerKey, password: consumerSecret },
      params,
      timeout: WOO_REQUEST_TIMEOUT_MS
    });
  } catch (error) {
    if (!consumerKey || !consumerSecret || !shouldRetryWooWithQueryAuth(error)) {
      throw error;
    }

    return await axios.get(url, {
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
      timeout: WOO_REQUEST_TIMEOUT_MS
    });
  }
}

async function wooPutWithFallback(url, consumerKey, consumerSecret, data) {
  try {
    return await axios.put(url, data, {
      auth: { username: consumerKey, password: consumerSecret },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Prokip-Integration/1.0'
      },
      timeout: WOO_REQUEST_TIMEOUT_MS
    });
  } catch (error) {
    if (!consumerKey || !consumerSecret || !shouldRetryWooWithQueryAuth(error)) {
      throw error;
    }

    return await axios.put(url, data, {
      params: {
        consumer_key: consumerKey,
        consumer_secret: consumerSecret
      },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Prokip-Integration/1.0',
        Accept: 'application/json'
      },
      timeout: WOO_REQUEST_TIMEOUT_MS
    });
  }
}

async function wooPostWithFallback(url, consumerKey, consumerSecret, data) {
  try {
    return await axios.post(url, data, {
      auth: { username: consumerKey, password: consumerSecret },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Prokip-Integration/1.0'
      },
      timeout: WOO_REQUEST_TIMEOUT_MS
    });
  } catch (error) {
    if (!consumerKey || !consumerSecret || !shouldRetryWooWithQueryAuth(error)) {
      throw error;
    }

    return await axios.post(url, data, {
      params: {
        consumer_key: consumerKey,
        consumer_secret: consumerSecret
      },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Prokip-Integration/1.0',
        Accept: 'application/json'
      },
      timeout: WOO_REQUEST_TIMEOUT_MS
    });
  }
}

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

function decryptAppPassword(connection) {
  let appPassword = connection.wooAppPassword;

  // Application passwords are stored encrypted; decrypt if needed
  if (appPassword && typeof appPassword === 'string' && appPassword.startsWith('{"encrypted":')) {
    try {
      const encryptedData = JSON.parse(appPassword);
      appPassword = wooSecureService.decrypt(encryptedData);
      console.log(' Application Password decrypted successfully');
    } catch (error) {
      console.error(' Failed to decrypt Application Password:', error.message);
      throw new Error('Failed to decrypt Application Password');
    }
  } else if (appPassword && typeof appPassword === 'object' && appPassword.encrypted) {
    try {
      appPassword = wooSecureService.decrypt(appPassword);
      console.log(' Application Password decrypted successfully');
    } catch (error) {
      console.error(' Failed to decrypt Application Password:', error.message);
      throw new Error('Failed to decrypt Application Password');
    }
  }

  return appPassword;
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
    const appPassword = decryptAppPassword(connection);
    
    console.log(`Creating/updating WooCommerce product at ${baseUrl}/wp-json/wc/v3/products`);
    
    // First try to find existing product by SKU
    try {
      if (consumerKey && consumerSecret) {
        const searchResponse = await wooGetWithFallback(
          `${baseUrl}/wp-json/wc/v3/products`,
          consumerKey,
          consumerSecret,
          { sku: product.sku, per_page: 1 }
        );
        
        if (searchResponse.data.length > 0) {
          // Update existing product
          const existingProduct = searchResponse.data[0];
          const updateData = {
            name: product.name,
            regular_price: product.price.toString(),
            manage_stock: product.stock_quantity !== undefined && product.stock_quantity !== null
          };
          if (product.stock_quantity !== undefined && product.stock_quantity !== null) {
            updateData.stock_quantity = product.stock_quantity;
          }
          
          await wooPutWithFallback(
            `${baseUrl}/wp-json/wc/v3/products/${existingProduct.id}`,
            consumerKey,
            consumerSecret,
            updateData
          );
          console.log(`Updated WooCommerce product: ${product.sku}`);
        } else {
          // Create new product
          await createProductInStore(connection, product);
          console.log(`Created WooCommerce product: ${product.sku}`);
        }
      } else if (connection.wooUsername && appPassword) {
        const client = wooAppPasswordService.createAuthenticatedClient(connection.storeUrl, connection.wooUsername, appPassword);
        const searchResponse = await client.get('products', { sku: product.sku, per_page: 1 });
        const results = Array.isArray(searchResponse.data) ? searchResponse.data : [];
        if (results.length > 0) {
          const existingProduct = results[0];
          const updateData = {
            name: product.name,
            regular_price: product.price.toString(),
            manage_stock: product.stock_quantity !== undefined && product.stock_quantity !== null
          };
          if (product.stock_quantity !== undefined && product.stock_quantity !== null) {
            updateData.stock_quantity = product.stock_quantity;
          }
          await client.put(`products/${existingProduct.id}`, updateData);
          console.log(`Updated WooCommerce product via App Password: ${product.sku}`);
        } else {
          await createProductInStore(connection, product);
          console.log(`Created WooCommerce product via App Password: ${product.sku}`);
        }
      } else {
        throw new Error('WooCommerce credentials are not configured.');
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
      const baseUrl = getWooBaseUrl(connection.storeUrl);
      const { consumerKey, consumerSecret } = decryptCredentials(connection);
      const appPassword = decryptAppPassword(connection);
      
      if (consumerKey && consumerSecret) {
        const searchResponse = await wooGetWithFallback(
          `${baseUrl}/wp-json/wc/v3/products`,
          consumerKey,
          consumerSecret,
          { sku: sku, per_page: 1 }
        );
        
        if (searchResponse.data.length === 0) {
          throw new Error(`Product with SKU ${sku} not found`);
        }
        
        const productId = searchResponse.data[0].id;
        
        await wooPutWithFallback(
          `${baseUrl}/wp-json/wc/v3/products/${productId}`,
          consumerKey,
          consumerSecret,
          {
            manage_stock: true,
            stock_quantity: quantity
          }
        );
      } else if (connection.wooUsername && appPassword) {
        const client = wooAppPasswordService.createAuthenticatedClient(connection.storeUrl, connection.wooUsername, appPassword);
        const searchResponse = await client.get('products', { sku: sku, per_page: 1 });
        const results = Array.isArray(searchResponse.data) ? searchResponse.data : [];
        
        if (results.length === 0) {
          throw new Error(`Product with SKU ${sku} not found`);
        }
        
        const productId = results[0].id;
        await client.put(`products/${productId}`, {
          manage_stock: true,
          stock_quantity: quantity
        });
      } else {
        throw new Error('WooCommerce credentials are not configured.');
      }
      
      console.log(`WooCommerce inventory updated: SKU ${sku}, New Stock: ${quantity}`);
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
    const appPassword = decryptAppPassword(connection);
    // Use application password authentication
    const isValid = await wooAppPasswordService.testConnection(
      storeUrl, 
      connection.wooUsername, 
      appPassword
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
    const appPassword = decryptAppPassword(connection);

    try {
      // Try application password first, then OAuth, then legacy credentials
      if (connection.wooUsername && appPassword) {
        console.log('Using WooCommerce application password authentication');
        // Use application password authentication
        const client = wooAppPasswordService.createAuthenticatedClient(
          connection.storeUrl, 
          connection.wooUsername, 
          appPassword
        );
        const response = await client.post('products', {
          name: product.name,
          sku: product.sku,
          regular_price: product.price.toString(),
          status: 'publish',
          ...(product.stock_quantity !== undefined && product.stock_quantity !== null
            ? { manage_stock: true, stock_quantity: product.stock_quantity }
            : {})
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
          ...(product.stock_quantity !== undefined && product.stock_quantity !== null
            ? { manage_stock: true, stock_quantity: product.stock_quantity }
            : {})
        });
        console.log('WooCommerce product created successfully via OAuth:', response.data);
      } else {
        console.log('Using WooCommerce legacy consumer key/secret authentication');
        // Use legacy consumer key/secret authentication
        const decrypted = decryptCredentials(connection);
        const consumerKey = decrypted.consumerKey || process.env.WOO_CONSUMER_KEY;
        const consumerSecret = decrypted.consumerSecret || process.env.WOO_CONSUMER_SECRET;

        if (!consumerKey || !consumerSecret) {
          throw new Error('WooCommerce credentials are not configured.');
        }

        const response = await wooPostWithFallback(`${baseUrl}/wp-json/wc/v3/products`, consumerKey, consumerSecret, {
          name: product.name,
          sku: product.sku,
          regular_price: product.price.toString(),
          status: 'publish',
          ...(product.stock_quantity !== undefined && product.stock_quantity !== null
            ? { manage_stock: true, stock_quantity: product.stock_quantity }
            : {})
        });
        console.log('WooCommerce product created successfully via legacy auth:', response.data);
      }
    } catch (error) {
      console.error('WooCommerce product creation failed:', error.response?.data || error.message);
      throw new Error(`Failed to create WooCommerce product: ${error.response?.data?.message || error.message}`);
    }
  }
}

module.exports = { createProductInStore, createOrUpdateProductInStore, updateInventoryInStore, verifyWooCommerceConnection, decryptCredentials, decryptAppPassword };
