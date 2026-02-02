/**
 * PROKIP AUTHENTICATION SERVICE
 * Handles JWT authentication with Prokip login endpoint
 * Manages token storage, refresh, and automatic re-authentication
 */

const axios = require('axios');
const crypto = require('crypto');

class ProkipAuthService {
  constructor() {
    this.baseURL = process.env.PROKIP_BASE_URL;
    this.username = process.env.PROKIP_USERNAME;
    this.password = process.env.PROKIP_PASSWORD;
    
    // Token storage in memory (in production, use encrypted storage)
    this.token = null;
    this.tokenExpiresAt = null;
    this.refreshToken = null;
    this.refreshExpiresAt = null;
    
    // Cache for connection-specific customer IDs
    this.customerIdCache = new Map();
  }

  /**
   * Authenticate with Prokip using username/password
   * @returns {Promise<Object>} - Token data
   */
  async authenticate() {
    try {
      console.log('🔐 Authenticating with Prokip...');
      console.log('📧 Username:', this.username);
      console.log('🌐 Login URL:', `${this.baseURL}/api/login`);

      const loginData = {
        email: this.username,
        password: this.password
      };

      const response = await axios.post(`${this.baseURL}/api/login`, loginData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      if (!response.data.token) {
        throw new Error('No token received from Prokip login');
      }

      // Store tokens securely
      this.token = response.data.token;
      this.refreshToken = response.data.refresh_token || null;
      
      // Calculate expiration (default 1 hour if not provided)
      const expiresIn = response.data.expires_in || 3600;
      this.tokenExpiresAt = new Date(Date.now() + (expiresIn * 1000));
      
      if (this.refreshToken) {
        const refreshExpiresIn = response.data.refresh_expires_in || 86400; // 24 hours default
        this.refreshExpiresAt = new Date(Date.now() + (refreshExpiresIn * 1000));
      }

      console.log('✅ Authentication successful');
      console.log('🕐 Token expires at:', this.tokenExpiresAt.toISOString());

      return {
        token: this.token,
        refreshToken: this.refreshToken,
        expiresAt: this.tokenExpiresAt
      };

    } catch (error) {
      console.error('❌ Prokip authentication failed:', error.message);
      if (error.response) {
        console.error('📄 Login response:', error.response.data);
      }
      throw new Error(`Prokip authentication failed: ${error.message}`);
    }
  }

  /**
   * Get valid Bearer token for API requests
   * @returns {Promise<string>} - Valid JWT token
   */
  async getValidToken() {
    // Check if we have a valid token
    if (this.token && this.tokenExpiresAt && this.tokenExpiresAt > new Date()) {
      console.log('✅ Using existing valid token');
      return this.token;
    }

    // Try to refresh if we have a refresh token
    if (this.refreshToken && this.refreshExpiresAt && this.refreshExpiresAt > new Date()) {
      console.log('🔄 Refreshing expired token...');
      try {
        await this.refreshToken();
        return this.token;
      } catch (refreshError) {
        console.log('⚠️ Token refresh failed, re-authenticating...');
      }
    }

    // Re-authenticate
    console.log('🔐 No valid token, authenticating...');
    await this.authenticate();
    return this.token;
  }

  /**
   * Refresh JWT token using refresh token
   */
  async refreshToken() {
    try {
      const response = await axios.post(`${this.baseURL}/api/refresh`, {
        refresh_token: this.refreshToken
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      if (!response.data.token) {
        throw new Error('No token received from refresh');
      }

      this.token = response.data.token;
      const expiresIn = response.data.expires_in || 3600;
      this.tokenExpiresAt = new Date(Date.now() + (expiresIn * 1000));

      console.log('✅ Token refreshed successfully');
      console.log('🕐 New token expires at:', this.tokenExpiresAt.toISOString());

    } catch (error) {
      console.error('❌ Token refresh failed:', error.message);
      throw error;
    }
  }

  /**
   * Get authorization headers for API requests
   * @returns {Promise<Object>} - Headers with Bearer token
   */
  async getAuthHeaders() {
    const token = await this.getValidToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * Get customer ID for a connection from Prokip
   * @param {number} connectionId - Connection ID
   * @returns {Promise<number>} - Customer ID from Prokip
   */
  async getCustomerId(connectionId) {
    // Check cache first
    if (this.customerIdCache.has(connectionId)) {
      return this.customerIdCache.get(connectionId);
    }

    try {
      console.log('🔍 Getting customer ID for connection:', connectionId);
      
      const headers = await this.getAuthHeaders();
      const response = await axios.get(`${this.baseURL}/api/customers/me`, {
        headers,
        timeout: 15000
      });

      const customerId = response.data.id;
      this.customerIdCache.set(connectionId, customerId);
      
      console.log('✅ Customer ID retrieved:', customerId);
      return customerId;

    } catch (error) {
      console.error('❌ Failed to get customer ID:', error.message);
      // Fallback to connection user ID
      return connectionId;
    }
  }

  /**
   * Check stock availability before placing order
   * @param {Object} products - Products object keyed by variation_id
   * @returns {Promise<Object>} - Stock check result
   */
  async checkStockAvailability(products) {
    try {
      console.log('🔍 Checking stock availability...');
      
      const headers = await this.getAuthHeaders();
      const variationIds = Object.keys(products);
      
      const response = await axios.post(`${this.baseURL}/api/stock/check`, {
        variation_ids: variationIds
      }, {
        headers,
        timeout: 15000
      });

      const stockData = response.data.stock || {};
      const insufficientStock = [];

      // Check each product
      Object.keys(products).forEach(variationId => {
        const requiredQty = products[variationId].quantity;
        const availableQty = stockData[variationId] || 0;
        
        if (requiredQty > availableQty) {
          insufficientStock.push({
            variation_id: parseInt(variationId),
            required: requiredQty,
            available: availableQty,
            product_name: products[variationId].product_name
          });
        }
      });

      return {
        sufficient: insufficientStock.length === 0,
        insufficientStock,
        stockData
      };

    } catch (error) {
      console.error('❌ Stock check failed:', error.message);
      // If stock check fails, allow order (will be validated by Laravel)
      return { sufficient: true, insufficientStock: [], stockData: {} };
    }
  }

  /**
   * Test authentication
   * @returns {Promise<boolean>} - True if authentication works
   */
  async testAuth() {
    try {
      await this.authenticate();
      console.log('✅ Authentication test successful');
      return true;
    } catch (error) {
      console.error('❌ Authentication test failed:', error.message);
      return false;
    }
  }

  /**
   * Clear stored tokens (for testing/logout)
   */
  clearTokens() {
    this.token = null;
    this.tokenExpiresAt = null;
    this.refreshToken = null;
    this.refreshExpiresAt = null;
    this.customerIdCache.clear();
    console.log('🧹 Tokens cleared');
  }
}

module.exports = new ProkipAuthService();
