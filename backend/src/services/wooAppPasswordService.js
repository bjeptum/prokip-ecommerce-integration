const axios = require('axios');
const crypto = require('crypto');
const { getWooBaseUrl } = require('./wooService');

/**
 * WooCommerce Application Password Service
 * Uses WordPress Application Passwords for secure authentication
 * Users only need to provide their WordPress URL and admin credentials
 */

class WooAppPasswordService {
  constructor() {
    this.appName = 'Prokip Integration';
    this.appId = 'prokip_woocommerce_sync';
  }

  /**
   * Generate a secure application password
   */
  generateSecurePassword() {
    return crypto.randomBytes(24).toString('base64');
  }

  /**
   * Create application password for WordPress user
   * This requires admin credentials to be provided once
   */
  async createApplicationPassword(storeUrl, username, password) {
    const baseUrl = getWooBaseUrl(storeUrl);
    const loginUrl = `${baseUrl}/wp-login.php`;
    
    try {
      // First, test if we can connect with provided credentials directly
      console.log('🔍 Testing direct WooCommerce API access...');
      const directTest = await this.testConnection(storeUrl, username, password);
      
      if (directTest) {
        console.log('✅ Direct API access works, using provided credentials');
        return {
          username: username,
          password: password,
          appName: 'Direct Credentials (Verified)',
          created: new Date().toISOString(),
          method: 'direct'
        };
      }
      
      console.log('🔐 Attempting to create application password...');
      
      // If direct test fails, try to create application password
      const authResponse = await axios.post(loginUrl, new URLSearchParams({
        log: username,
        pwd: password,
        rememberme: 'forever',
        'wp-submit': 'Log In',
        redirect_to: `${baseUrl}/wp-admin/`
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        maxRedirects: 0,
        validateStatus: (status) => status < 400
      });

      // Extract cookies from response
      const cookies = authResponse.headers['set-cookie'];
      if (!cookies) {
        console.warn('⚠️  No cookies received, WordPress might have security restrictions');
        throw new Error('WordPress login failed. Please check your credentials and ensure Application Passwords are enabled.');
      }

      // Create application password using WordPress REST API
      const appPassword = this.generateSecurePassword();
      const appName = `${this.appName} - ${new Date().toISOString().split('T')[0]}`;

      const passwordResponse = await axios.post(
        `${baseUrl}/wp-json/wp/v2/users/me/application-passwords`,
        {
          name: appName,
          app_id: this.appId,
          password: appPassword
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookies.join('; ')
          }
        }
      );

      const passwordData = passwordResponse.data;
      return {
        username: username,
        password: passwordData.password || appPassword,
        uuid: passwordData.uuid || 'generated',
        appName: passwordData.name || appName,
        created: passwordData.created || new Date().toISOString(),
        method: 'application_password'
      };

    } catch (error) {
      console.error('Application password creation failed:', error.message);
      
      // Final fallback: Try direct credentials one more time
      console.log('🔄 Final fallback: testing direct credentials...');
      const finalTest = await this.testConnection(storeUrl, username, password);
      
      if (finalTest) {
        console.log('✅ Fallback successful - using direct credentials');
        return {
          username: username,
          password: password,
          appName: 'Direct Credentials (Fallback)',
          created: new Date().toISOString(),
          method: 'direct_fallback'
        };
      }
      
      throw new Error(`Failed to connect to WooCommerce: ${error.message}. Please verify:\n1. Store URL is correct\n2. WordPress admin credentials are valid\n3. WooCommerce REST API is enabled\n4. Application Passwords are allowed in your WordPress installation`);
    }
  }

  /**
   * Test WooCommerce connection with application password
   */
  async testConnection(storeUrl, username, appPassword) {
    const baseUrl = getWooBaseUrl(storeUrl);
    
    // Try multiple WooCommerce API endpoints to validate connection
    const testEndpoints = [
      '/wp-json/wc/v3', // Root endpoint - most likely to work
      '/wp-json/wc/v3/system_status',
      '/wp-json/wc/v3/products',
      '/wp-json/wc/v3/orders'
    ];
    
    console.log('🔍 Testing WooCommerce API access...');
    console.log('Store URL:', storeUrl);
    console.log('Username:', username);
    console.log('Base URL:', baseUrl);
    
    for (const endpoint of testEndpoints) {
      const testUrl = `${baseUrl}${endpoint}`;
      console.log('Testing endpoint:', testUrl);
      
      try {
        const response = await axios.get(testUrl, {
          auth: {
            username: username,
            password: appPassword
          },
          headers: {
            'User-Agent': 'Prokip-Integration/1.0',
            'Accept': 'application/json'
          },
          timeout: 15000,
          validateStatus: (status) => status < 500 // Don't throw on 4xx errors
        });

        console.log(`Response status for ${endpoint}:`, response.status);
        console.log(`Response headers for ${endpoint}:`, response.headers['content-type']);
        
        // Check if we got a successful response
        if (response.status === 200) {
          const responseData = response.data;
          console.log(`Response data for ${endpoint}:`, responseData);
          
          // Validate this is a JSON response (WooCommerce API returns JSON)
          if (typeof responseData === 'object') {
            // Check for WooCommerce-specific indicators
            const isWooCommerce = this.validateWooCommerceResponse(responseData, endpoint);
            
            if (isWooCommerce) {
              console.log(`✅ WooCommerce API validated via ${endpoint}`);
              return true;
            } else {
              console.log(`⚠️  Response from ${endpoint} doesn't look like WooCommerce`);
              console.log('Response data sample:', JSON.stringify(responseData).substring(0, 200));
            }
          } else {
            console.log(`⚠️  Non-JSON response from ${endpoint}`);
          }
        } else if (response.status === 401) {
          console.log(`❌ Authentication failed for ${endpoint}`);
          // For root endpoint, 401 means credentials are definitely wrong
          // For other endpoints, we can continue trying
          if (endpoint === '/wp-json/wc/v3') {
            return false;
          }
          // Continue trying other endpoints
        } else if (response.status === 403) {
          console.log(`❌ Forbidden for ${endpoint} - insufficient permissions`);
          // Continue trying other endpoints
        } else if (response.status === 404) {
          console.log(`⚠️  Endpoint ${endpoint} not found, trying next...`);
          // Continue trying other endpoints
        } else {
          console.log(`⚠️  Unexpected status ${response.status} for ${endpoint}`);
        }
      } catch (error) {
        console.log(`❌ Error testing ${endpoint}:`, error.message);
        
        if (error.response) {
          if (error.response.status === 401) {
            console.log('❌ Authentication failed - invalid credentials');
            // For root endpoint, 401 means credentials are definitely wrong
            // For other endpoints, we can continue trying
            if (endpoint === '/wp-json/wc/v3') {
              return false;
            }
            // Continue trying other endpoints
          } else if (error.response.status === 403) {
            console.log('❌ Forbidden - insufficient permissions');
            // Continue trying other endpoints
          } else if (error.response.status === 404) {
            console.log('⚠️  Endpoint not found, trying next...');
            // Continue trying other endpoints
          }
        } else if (error.code === 'ENOTFOUND') {
          console.log('❌ DNS resolution failed - invalid store URL');
          return false;
        } else if (error.code === 'ECONNREFUSED') {
          console.log('❌ Connection refused - server not reachable');
          return false;
        } else if (error.code === 'ETIMEDOUT') {
          console.log('❌ Connection timeout - server slow or blocking requests');
          // Continue trying other endpoints
        } else {
          console.log('⚠️  Network error, trying next endpoint...');
        }
      }
    }
    
    console.log('❌ All WooCommerce endpoints failed validation');
    return false;
  }
  
  /**
   * Validate if response is from WooCommerce API
   */
  validateWooCommerceResponse(data, endpoint) {
    try {
      // Check for various WooCommerce response patterns
      
      if (endpoint === '/wp-json/wc/v3/system_status') {
        // System status endpoint should have system info
        return data.system || data.settings || data.database || data.environment;
      }
      
      if (endpoint === '/wp-json/wc/v3/products') {
        // Products endpoint should have array of products or pagination info
        return Array.isArray(data) || (data && typeof data === 'object' && (data.length !== undefined || data.data));
      }
      
      if (endpoint === '/wp-json/wc/v3/orders') {
        // Orders endpoint should have array of orders or pagination info
        return Array.isArray(data) || (data && typeof data === 'object' && (data.length !== undefined || data.data));
      }
      
      if (endpoint === '/wp-json/wc/v3') {
        // Root endpoint should have routes or API info
        return data.routes || data.namespace || data.description;
      }
      
      // Generic validation - check for common WooCommerce response patterns
      if (Array.isArray(data)) {
        // Array response is likely valid (products, orders, etc.)
        return true;
      }
      
      if (typeof data === 'object' && data !== null) {
        // Object response - check for common WooCommerce fields
        const wooFields = ['id', 'name', 'slug', 'status', 'date_created', 'date_modified', 
                         'total', 'price', 'regular_price', 'sale_price', 'sku', 'stock_status',
                         'routes', 'namespace', 'description', 'system', 'settings'];
        
        const hasWooField = Object.keys(data).some(key => wooFields.includes(key));
        if (hasWooField) {
          return true;
        }
        
        // Check if it has pagination structure (common in WooCommerce)
        if (data.data || data.length !== undefined || data.page || data.per_page) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error validating WooCommerce response:', error);
      return false;
    }
  }

  /**
   * Create authenticated API client
   */
  createAuthenticatedClient(storeUrl, username, appPassword) {
    const baseUrl = getWooBaseUrl(storeUrl);
    
    return {
      get: async (endpoint, params = {}) => {
        const url = `${baseUrl}/wp-json/wc/v3/${endpoint}`;
        return await axios.get(url, {
          params,
          auth: {
            username: username,
            password: appPassword
          },
          headers: {
            'User-Agent': 'Prokip-Integration/1.0'
          },
          timeout: 15000
        });
      },
      
      post: async (endpoint, data = {}) => {
        const url = `${baseUrl}/wp-json/wc/v3/${endpoint}`;
        return await axios.post(url, data, {
          auth: {
            username: username,
            password: appPassword
          },
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Prokip-Integration/1.0'
          },
          timeout: 15000
        });
      },

      put: async (endpoint, data = {}) => {
        const url = `${baseUrl}/wp-json/wc/v3/${endpoint}`;
        return await axios.put(url, data, {
          auth: {
            username: username,
            password: appPassword
          },
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Prokip-Integration/1.0'
          },
          timeout: 15000
        });
      }
    };
  }

  /**
   * Register webhooks using application password
   */
  async registerWebhooks(storeUrl, username, appPassword) {
    const client = this.createAuthenticatedClient(storeUrl, username, appPassword);
    const webhookUrl = process.env.WEBHOOK_URL || 
      `http://localhost:${process.env.PORT || 3000}/connections/webhook/woocommerce`;

    try {
      // Check if webhook already exists
      try {
        const { data: webhooks } = await client.get('webhooks');
        const exists = webhooks.find(
          w => w.delivery_url === webhookUrl && w.topic === 'order.created'
        );
        if (exists) return;
      } catch (err) {
        console.warn('Skipping webhook existence check');
      }

      // Create webhook
      await client.post('webhooks', {
        name: 'Prokip Order Sync',
        topic: 'order.created',
        delivery_url: webhookUrl,
        secret: process.env.WOO_WEBHOOK_SECRET || 'prokip_secret'
      });

      console.log(`✅ WooCommerce webhook registered for ${storeUrl}`);
    } catch (error) {
      console.error(`❌ Webhook creation failed for ${storeUrl}:`, error.message);
      throw new Error('Failed to register WooCommerce webhook');
    }
  }
}

module.exports = new WooAppPasswordService();
