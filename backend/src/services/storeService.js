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
    
    // Create product with inventory management enabled
    const response = await axios.post(`${baseUrl}/admin/api/2026-01/products.json`, {
      product: {
        title: product.title,
        variants: [{
          sku: product.sku,
          price: product.price,
          inventory_management: 'shopify', // Enable inventory tracking!
          inventory_policy: 'deny', // Don't allow overselling
          requires_shipping: true
        }]
      }
    }, {
      headers: { 'X-Shopify-Access-Token': connection.accessToken }
    });
    
    const createdProduct = response.data.product;
    
    // Set initial inventory if stock_quantity provided
    if (product.stock_quantity !== undefined && product.stock_quantity !== null) {
      const variant = createdProduct.variants[0];
      const inventoryItemId = variant.inventory_item_id;
      
      if (inventoryItemId) {
        try {
          // Get locations
          const locations = await getShopifyLocations(connection.storeUrl, connection.accessToken);
          if (locations && locations.length > 0) {
            const locationId = locations[0].id;
            
            // Set inventory level
            await axios.post(`${baseUrl}/admin/api/2026-01/inventory_levels/set.json`, {
              location_id: locationId,
              inventory_item_id: inventoryItemId,
              available: parseInt(product.stock_quantity) || 0
            }, {
              headers: { 'X-Shopify-Access-Token': connection.accessToken }
            });
            
            console.log(`✅ Shopify inventory set for ${product.title}: ${product.stock_quantity} units`);
          }
        } catch (invError) {
          console.error('⚠️ Could not set initial Shopify inventory:', invError.response?.data || invError.message);
        }
      }
    }
    
    return createdProduct;
  } else if (connection.platform === 'woocommerce') {
    const baseUrl = getWooBaseUrl(connection.storeUrl);
    
    // Product data with stock management enabled
    const productData = {
      name: product.name || product.title,
      sku: product.sku,
      regular_price: product.price?.toString() || '0',
      manage_stock: true, // Enable stock management!
      stock_quantity: parseInt(product.stock_quantity) || 0,
      stock_status: (parseInt(product.stock_quantity) || 0) > 0 ? 'instock' : 'outofstock'
    };
    
    // Try application password first, then OAuth, then legacy credentials
    if (connection.wooUsername && connection.wooAppPassword) {
      // Use application password authentication
      const client = wooAppPasswordService.createAuthenticatedClient(
        connection.storeUrl, 
        connection.wooUsername, 
        connection.wooAppPassword
      );
      const response = await client.post('products', productData);
      console.log(`✅ WooCommerce product created with stock: ${product.stock_quantity}`);
      return response.data;
    } else if (connection.accessToken && connection.accessTokenSecret) {
      // Use OAuth authentication
      const client = wooOAuthService.createAuthenticatedClient(
        connection.storeUrl, 
        connection.accessToken, 
        connection.accessTokenSecret
      );
      const response = await client.post('products', productData);
      console.log(`✅ WooCommerce product created with stock: ${product.stock_quantity}`);
      return response.data;
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
          JSON.stringify(productData),
          'application/json',
          (error, data) => {
            if (error) reject(error);
            else {
              console.log(`✅ WooCommerce product created with stock: ${product.stock_quantity}`);
              resolve(JSON.parse(data));
            }
          }
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
