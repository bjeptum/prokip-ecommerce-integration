const axios = require('axios');
const { getWooBaseUrl } = require('./wooService');

/**
 * Simple WooCommerce Application Password Service
 * Focused on making Application Password work with your setup
 */
class WooSimpleAppPassword {
  constructor() {
    this.appName = 'Prokip Integration';
  }

  /**
   * Test WooCommerce connection with Application Password
   */
  async testConnection(storeUrl, username, appPassword) {
    const baseUrl = getWooBaseUrl(storeUrl);
    
    try {
      // Test root endpoint first (most reliable)
      const rootUrl = `${baseUrl}/wp-json/wc/v3`;
      console.log(`Testing root endpoint: ${rootUrl}`);

      const response = await axios.get(rootUrl, {
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

      console.log(`Root endpoint status: ${response.status}`);
      
      if (response.status === 200 && response.data.namespace === 'wc/v3') {
        console.log('✅ WooCommerce API accessible');
        return true;
      } else {
        console.log('❌ Invalid WooCommerce response');
        return false;
      }

    } catch (error) {
      console.log('❌ Connection test failed:', error.message);
      
      if (error.response?.status === 401) {
        console.log('🔐 Authentication failed - credentials incorrect');
      } else if (error.code === 'ENOTFOUND') {
        console.log('🌐 DNS resolution failed - invalid URL');
      }
      
      return false;
    }
  }

  /**
   * Create authenticated client for product fetching
   */
  createAuthenticatedClient(storeUrl, username, appPassword) {
    const baseUrl = getWooBaseUrl(storeUrl);
    
    return {
      get: async (endpoint, params = {}) => {
        const url = `${baseUrl}/wp-json/wc/v3/${endpoint}`;
        console.log(`Fetching: ${url}`);
        
        try {
          const response = await axios.get(url, {
            params,
            auth: {
              username: username,
              password: appPassword
            },
            headers: {
              'User-Agent': 'Prokip-Integration/1.0',
              'Accept': 'application/json'
            },
            timeout: 15000
          });
          
          return response;
        } catch (error) {
          console.log(`❌ Failed to fetch ${endpoint}:`, error.response?.data?.message || error.message);
          throw error;
        }
      }
    };
  }

  /**
   * Check if user has WooCommerce capabilities
   */
  async checkWooCommerceCapabilities(storeUrl, username, appPassword) {
    const baseUrl = getWooBaseUrl(storeUrl);
    
    try {
      // Test products endpoint
      const productsUrl = `${baseUrl}/wp-json/wc/v3/products?per_page=1`;
      const response = await axios.get(productsUrl, {
        auth: {
          username: username,
          password: appPassword
        },
        headers: {
          'User-Agent': 'Prokip-Integration/1.0',
          'Accept': 'application/json'
        },
        timeout: 15000
      });

      console.log('✅ User has WooCommerce product access');
      return {
        success: true,
        message: 'User can access WooCommerce products'
      };

    } catch (error) {
      if (error.response?.data?.code === 'woocommerce_rest_cannot_view') {
        return {
          success: false,
          issue: 'WOOCOMMERCE_PERMISSIONS',
          message: 'User cannot view WooCommerce products',
          error: error.response.data.message
        };
      }

      return {
        success: false,
        issue: 'OTHER_ERROR',
        message: error.response?.data?.message || error.message
      };
    }
  }
}

module.exports = new WooSimpleAppPassword();
