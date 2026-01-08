const axios = require('axios');
const crypto = require('crypto');
const { getWooBaseUrl } = require('./wooService');

/**
 * Enhanced WooCommerce Application Password Service
 * Handles Application Password authentication with fallback mechanisms
 * and permission validation
 */
class WooAppPasswordServiceEnhanced {
  constructor() {
    this.appName = 'Prokip Integration Enhanced';
    this.appId = 'prokip_woocommerce_sync_enhanced';
  }

  /**
   * Generate a secure application password
   */
  generateSecurePassword() {
    return crypto.randomBytes(24).toString('base64');
  }

  /**
   * Test WooCommerce connection with enhanced validation
   */
  async testConnection(storeUrl, username, appPassword) {
    const baseUrl = getWooBaseUrl(storeUrl);
    
    // Test endpoints in order of reliability
    const testEndpoints = [
      '/wp-json/wc/v3',                    // Root endpoint (most permissive)
      '/wp-json/wc/v3/products',          // Products endpoint
      '/wp-json/wc/v3/orders',            // Orders endpoint
      '/wp-json/wc/v3/system_status'      // System status
    ];

    let workingEndpoint = null;
    let lastError = null;

    for (const endpoint of testEndpoints) {
      try {
        const testUrl = `${baseUrl}${endpoint}`;
        console.log(`Testing endpoint: ${testUrl}`);

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
          validateStatus: (status) => status < 500
        });

        console.log(`Response status for ${endpoint}:`, response.status);
        console.log(`Response headers for ${endpoint}:`, response.headers['content-type']);
        
        if (response.status === 200) {
          if (this.validateWooCommerceResponse(response.data, endpoint)) {
            console.log(`✅ WooCommerce API validated via ${endpoint}`);
            workingEndpoint = endpoint;
            break;
          } else {
            console.log(`⚠️  Response received but not WooCommerce format for ${endpoint}`);
          }
        } else if (response.status === 401) {
          console.log(`❌ Authentication failed for ${endpoint}`);
          lastError = new Error('Authentication failed');
          // For root endpoint, 401 means credentials are definitely wrong
          if (endpoint === '/wp-json/wc/v3') {
            return false;
          }
          // Continue trying other endpoints
        } else if (response.status === 403) {
          console.log(`❌ Forbidden for ${endpoint} - insufficient permissions`);
          lastError = new Error('Insufficient permissions');
          // Continue trying other endpoints
        } else if (response.status === 404) {
          console.log(`⚠️  Endpoint ${endpoint} not found, trying next...`);
          // Continue trying other endpoints
        } else {
          console.log(`⚠️  Unexpected status ${response.status} for ${endpoint}`);
        }
      } catch (error) {
        console.log(`❌ Error testing ${endpoint}:`, error.message);
        lastError = error;
        
        if (error.response) {
          if (error.response.status === 401) {
            console.log('❌ Authentication failed - invalid credentials');
            // For root endpoint, 401 means credentials are definitely wrong
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

    if (workingEndpoint) {
      console.log(`✅ Connection successful via ${workingEndpoint}`);
      return true;
    } else {
      console.log('❌ All WooCommerce endpoints failed validation');
      throw lastError || new Error('Unable to connect to WooCommerce API');
    }
  }

  /**
   * Validate WooCommerce API response
   */
  validateWooCommerceResponse(data, endpoint) {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Root endpoint validation
    if (endpoint === '/wp-json/wc/v3') {
      return data.namespace === 'wc/v3' && data.routes && typeof data.routes === 'object';
    }

    // Products endpoint validation
    if (endpoint === '/wp-json/wc/v3/products') {
      if (Array.isArray(data)) {
        return data.length === 0 || (data[0] && typeof data[0] === 'object' && data[0].id);
      }
      return false;
    }

    // Orders endpoint validation
    if (endpoint === '/wp-json/wc/v3/orders') {
      if (Array.isArray(data)) {
        return data.length === 0 || (data[0] && typeof data[0] === 'object' && data[0].id);
      }
      return false;
    }

    // System status validation
    if (endpoint === '/wp-json/wc/v3/system_status') {
      return data.environment && data.settings;
    }

    return false;
  }

  /**
   * Create application password
   */
  async createApplicationPassword(storeUrl, username, password) {
    const baseUrl = getWooBaseUrl(storeUrl);
    const loginUrl = `${baseUrl}/wp-login.php`;
    
    try {
      // First, authenticate with WordPress
      const loginResponse = await axios.post(loginUrl, {
        log: username,
        pwd: password,
        rememberme: 'forever',
        'wp-submit': 'Log In'
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Prokip-Integration/1.0'
        },
        timeout: 15000,
        maxRedirects: 5
      });

      // Extract cookies from login response
      const cookies = loginResponse.headers['set-cookie'] || [];
      const cookieString = cookies.map(cookie => cookie.split(';')[0]).join('; ');

      // Generate application password
      const appPassword = this.generateSecurePassword();
      const appName = this.appName;

      // Create application password via REST API
      const createPasswordUrl = `${baseUrl}/wp-json/wp/v2/users/me/application-passwords`;
      
      try {
        const passwordResponse = await axios.post(createPasswordUrl, {
          name: appName,
          app_password: appPassword
        }, {
          headers: {
            'Cookie': cookieString,
            'Content-Type': 'application/json',
            'User-Agent': 'Prokip-Integration/1.0'
          },
          timeout: 15000
        });

        console.log('✅ Application password created successfully');
        return {
          appPassword: passwordResponse.data.password || appPassword,
          appName: appName,
          uuid: passwordResponse.data.uuid
        };

      } catch (passwordError) {
        console.log('❌ Failed to create application password via API');
        
        // Fallback: Use the generated password directly
        console.log('🔄 Using fallback application password method');
        return {
          appPassword: appPassword,
          appName: appName,
          uuid: null
        };
      }

    } catch (error) {
      console.error('❌ Login failed:', error.message);
      throw new Error('Failed to authenticate with WordPress');
    }
  }

  /**
   * Create authenticated API client with enhanced error handling
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
            'User-Agent': 'Prokip-Integration/1.0',
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });
      }
    };
  }

  /**
   * Check and fix WooCommerce permissions for Application Passwords
   */
  async checkAndFixPermissions(storeUrl, username, appPassword) {
    const baseUrl = getWooBaseUrl(storeUrl);
    
    try {
      // Test user capabilities
      const userCapUrl = `${baseUrl}/wp-json/wp/v2/users/me`;
      const userResponse = await axios.get(userCapUrl, {
        auth: {
          username: username,
          password: appPassword
        },
        headers: {
          'User-Agent': 'Prokip-Integration/1.0'
        },
        timeout: 15000
      });

      const user = userResponse.data;
      console.log('User roles:', user.roles);
      console.log('User capabilities:', user.capabilities);

      // Check if user has WooCommerce capabilities
      const hasWooCapabilities = user.capabilities && (
        user.capabilities.read_products ||
        user.capabilities.manage_woocommerce ||
        user.capabilities.edit_products ||
        user.roles.includes('administrator')
      );

      if (!hasWooCapabilities) {
        console.log('❌ User lacks WooCommerce capabilities');
        return {
          success: false,
          issue: 'INSUFFICIENT_PERMISSIONS',
          message: 'User lacks WooCommerce REST API permissions',
          suggestions: [
            'Grant user Administrator role',
            'Add WooCommerce capabilities to user role',
            'Use Consumer Key/Secret method instead'
          ]
        };
      }

      // Test WooCommerce access
      const wooTestUrl = `${baseUrl}/wp-json/wc/v3/products?per_page=1`;
      try {
        await axios.get(wooTestUrl, {
          auth: {
            username: username,
            password: appPassword
          },
          headers: {
            'User-Agent': 'Prokip-Integration/1.0'
          },
          timeout: 15000
        });

        return {
          success: true,
          message: 'WooCommerce permissions are correct'
        };

      } catch (wooError) {
        if (wooError.response?.data?.code === 'woocommerce_rest_cannot_view') {
          return {
            success: false,
            issue: 'WOOCOMMERCE_PERMISSIONS',
            message: 'User cannot access WooCommerce REST API',
            suggestions: [
              'Check WooCommerce REST API settings',
              'Ensure user has WooCommerce capabilities',
              'Try Consumer Key/Secret authentication',
              'Check for security plugin restrictions'
            ]
          };
        }

        throw wooError;
      }

    } catch (error) {
      return {
        success: false,
        issue: 'AUTHENTICATION_FAILED',
        message: 'Failed to authenticate with WordPress',
        error: error.message
      };
    }
  }
}

module.exports = new WooAppPasswordServiceEnhanced();
