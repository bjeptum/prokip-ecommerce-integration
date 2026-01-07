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
      // First, authenticate with WordPress
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
        throw new Error('Failed to authenticate with WordPress');
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
        password: passwordData.password,
        uuid: passwordData.uuid,
        appName: passwordData.name,
        created: passwordData.created
      };

    } catch (error) {
      console.error('Failed to create application password:', error.message);
      
      // Fallback: Try to use existing application password or create manually
      throw new Error('Failed to create application password. Please ensure you have admin access and Application Passwords are enabled.');
    }
  }

  /**
   * Test WooCommerce connection with application password
   */
  async testConnection(storeUrl, username, appPassword) {
    const baseUrl = getWooBaseUrl(storeUrl);
    const testUrl = `${baseUrl}/wp-json/wc/v3/system_status`;
    
    try {
      const response = await axios.get(testUrl, {
        auth: {
          username: username,
          password: appPassword
        },
        headers: {
          'User-Agent': 'Prokip-Integration/1.0'
        },
        timeout: 10000
      });

      return response.status === 200;
    } catch (error) {
      console.error('Connection test failed:', error.message);
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
