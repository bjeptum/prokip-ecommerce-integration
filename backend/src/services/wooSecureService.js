const axios = require('axios');
const crypto = require('crypto');
const { getWooBaseUrl } = require('./wooService');

/**
 * Secure WooCommerce Consumer Key/Secret Service
 * Handles encryption, validation, and multi-user connections
 */
class WooSecureService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    // Create a 32-byte key from the environment variable
    const keyString = process.env.ENCRYPTION_KEY || 'default_encryption_key';
    this.secretKey = crypto.createHash('sha256').update(keyString).digest();
    this.ivLength = 16;
    this.tagLength = 16;
  }

  /**
   * Encrypt sensitive data (Consumer Key/Secret)
   */
  encrypt(text) {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, iv);
      cipher.setAAD(Buffer.from('woocommerce-key', 'utf8'));
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      return {
        encrypted: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      throw new Error('Encryption failed: ' + error.message);
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData) {
    try {
      const decipher = crypto.createDecipheriv(this.algorithm, this.secretKey, Buffer.from(encryptedData.iv, 'hex'));
      decipher.setAAD(Buffer.from('woocommerce-key', 'utf8'));
      decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed: ' + error.message);
    }
  }

  /**
   * Validate WooCommerce Consumer Key/Secret
   */
  async validateCredentials(storeUrl, consumerKey, consumerSecret) {
    const baseUrl = getWooBaseUrl(storeUrl);
    
    try {
      // Test root endpoint first
      const rootUrl = `${baseUrl}/wp-json/wc/v3`;
      console.log(`🔍 Validating credentials for: ${storeUrl}`);
      
      const rootResponse = await axios.get(rootUrl, {
        auth: {
          username: consumerKey,
          password: consumerSecret
        },
        headers: {
          'User-Agent': 'Prokip-Integration/1.0',
          'Accept': 'application/json'
        },
        timeout: 15000,
        validateStatus: (status) => status < 500
      });

      if (rootResponse.status !== 200 || rootResponse.data.namespace !== 'wc/v3') {
        throw new Error('Invalid WooCommerce API response');
      }

      // Test products endpoint for permissions
      const productsUrl = `${baseUrl}/wp-json/wc/v3/products?per_page=1`;
      const productsResponse = await axios.get(productsUrl, {
        auth: {
          username: consumerKey,
          password: consumerSecret
        },
        headers: {
          'User-Agent': 'Prokip-Integration/1.0',
          'Accept': 'application/json'
        },
        timeout: 15000
      });

      return {
        valid: true,
        message: 'Credentials are valid and have product access',
        productsAccessible: true,
        storeInfo: {
          url: storeUrl,
          apiVersion: rootResponse.data.version || 'v3',
          permissions: {
            products: true,
            orders: true // Assume if products work, orders work too
          }
        }
      };

    } catch (error) {
      console.log('❌ Credential validation failed:', error.message);
      
      if (error.response?.status === 401) {
        return {
          valid: false,
          error: 'INVALID_CREDENTIALS',
          message: 'Consumer Key or Secret is invalid',
          details: 'Please check your WooCommerce API keys and ensure they are correct'
        };
      } else if (error.response?.status === 403) {
        return {
          valid: false,
          error: 'INSUFFICIENT_PERMISSIONS',
          message: 'API keys lack required permissions',
          details: 'Ensure your Consumer Key has read/write permissions for products and orders'
        };
      } else if (error.response?.data?.code === 'woocommerce_rest_cannot_view') {
        return {
          valid: false,
          error: 'WOOCOMMERCE_PERMISSIONS',
          message: 'User cannot access WooCommerce resources',
          details: 'The API user lacks WooCommerce REST API permissions'
        };
      } else if (error.code === 'ENOTFOUND') {
        return {
          valid: false,
          error: 'INVALID_URL',
          message: 'Store URL is not accessible',
          details: 'Please verify your store URL is correct and accessible'
        };
      } else if (error.code === 'ECONNREFUSED') {
        return {
          valid: false,
          error: 'CONNECTION_REFUSED',
          message: 'Connection to store was refused',
          details: 'The store may be down or blocking requests'
        };
      } else if (error.code === 'ETIMEDOUT') {
        return {
          valid: false,
          error: 'TIMEOUT',
          message: 'Connection timeout',
          details: 'The store is taking too long to respond'
        };
      } else {
        return {
          valid: false,
          error: 'UNKNOWN_ERROR',
          message: 'Validation failed',
          details: error.message
        };
      }
    }
  }

  /**
   * Create authenticated client for API calls
   */
  createAuthenticatedClient(storeUrl, consumerKey, consumerSecret) {
    const baseUrl = getWooBaseUrl(storeUrl);
    
    return {
      get: async (endpoint, params = {}) => {
        const url = `${baseUrl}/wp-json/wc/v3/${endpoint}`;
        
        try {
          const response = await axios.get(url, {
            params,
            auth: {
              username: consumerKey,
              password: consumerSecret
            },
            headers: {
              'User-Agent': 'Prokip-Integration/1.0',
              'Accept': 'application/json'
            },
            timeout: 30000
          });
          
          return response;
        } catch (error) {
          console.log(`❌ API call failed for ${endpoint}:`, error.response?.data?.message || error.message);
          throw error;
        }
      },
      
      post: async (endpoint, data = {}) => {
        const url = `${baseUrl}/wp-json/wc/v3/${endpoint}`;
        
        try {
          const response = await axios.post(url, data, {
            auth: {
              username: consumerKey,
              password: consumerSecret
            },
            headers: {
              'User-Agent': 'Prokip-Integration/1.0',
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            timeout: 30000
          });
          
          return response;
        } catch (error) {
          console.log(`❌ API POST failed for ${endpoint}:`, error.response?.data?.message || error.message);
          throw error;
        }
      }
    };
  }

  /**
   * Test connection without storing credentials
   */
  async testConnection(storeUrl, consumerKey, consumerSecret) {
    console.log('🧪 Testing WooCommerce connection...');
    
    const validation = await this.validateCredentials(storeUrl, consumerKey, consumerSecret);
    
    if (validation.valid) {
      console.log('✅ Connection test successful');
      
      // Try to fetch a few products to ensure full functionality
      try {
        const client = this.createAuthenticatedClient(storeUrl, consumerKey, consumerSecret);
        const productsResponse = await client.get('products?per_page=5');
        
        return {
          ...validation,
          testResults: {
            productsFetched: productsResponse.data.length,
            sampleProducts: productsResponse.data.map(p => ({
              id: p.id,
              name: p.name,
              price: p.regular_price || '0.00'
            }))
          }
        };
      } catch (productError) {
        return {
          ...validation,
          valid: false,
          error: 'PRODUCT_ACCESS_FAILED',
          message: 'Credentials are valid but cannot access products',
          details: productError.response?.data?.message || productError.message
        };
      }
    } else {
      console.log('❌ Connection test failed:', validation.message);
      return validation;
    }
  }

  /**
   * Get store information
   */
  async getStoreInfo(storeUrl, consumerKey, consumerSecret) {
    try {
      const client = this.createAuthenticatedClient(storeUrl, consumerKey, consumerSecret);
      
      // Get system status
      const systemStatus = await client.get('system_status');
      
      // Get store settings
      const settings = await client.get('settings/general');
      
      return {
        storeName: settings.data.woocommerce_store_title || 'Unknown Store',
        storeUrl: storeUrl,
        wooVersion: systemStatus.data.environment.version,
        apiVersion: systemStatus.data.environment.api_version,
        currency: settings.data.woocommerce_currency || 'USD',
        timezone: systemStatus.data.environment.timezone
      };
    } catch (error) {
      console.log('❌ Failed to get store info:', error.message);
      return {
        storeName: 'Unknown Store',
        storeUrl: storeUrl,
        error: error.message
      };
    }
  }

  /**
   * Format Consumer Key for display (hide sensitive parts)
   */
  formatConsumerKeyForDisplay(consumerKey) {
    if (!consumerKey || consumerKey.length < 10) {
      return '***';
    }
    return consumerKey.substring(0, 8) + '***' + consumerKey.substring(consumerKey.length - 4);
  }
}

module.exports = new WooSecureService();
