const axios = require('axios');
const crypto = require('crypto');

class ProkipService {
  constructor() {
    this.baseURL = process.env.PROKIP_API_URL || 'https://api.prokip.africa';
    this.apiKey = process.env.PROKIP_API_KEY;
    
    if (!this.apiKey) {
      throw new Error('PROKIP_API_KEY environment variable is required');
    }
    
    // Configure axios instance
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Prokip-Connector-Plugin/1.0.0'
      }
    });
    
    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🔗 Prokip API Request: ${config.method.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ Prokip API Request Error:', error.message);
        return Promise.reject(error);
      }
    );
    
    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ Prokip API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        const status = error.response?.status;
        const url = error.config?.url;
        console.error(`❌ Prokip API Error: ${status} ${url}`);
        
        if (error.response?.data) {
          console.error('   Error details:', error.response.data);
        }
        
        return Promise.reject(this.handleError(error));
      }
    );
  }
  
  /**
   * Handle API errors and convert to standardized format
   */
  handleError(error) {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data;
      
      switch (status) {
        case 401:
          return new Error('Authentication failed with Prokip API. Check API key.');
        case 403:
          return new Error('Access forbidden. Insufficient permissions for this operation.');
        case 404:
          return new Error('Prokip API endpoint not found.');
        case 422:
          return new Error(`Validation error: ${data.message || 'Invalid data provided'}`);
        case 429:
          return new Error('Rate limit exceeded. Please try again later.');
        case 500:
          return new Error('Prokip server error. Please try again later.');
        default:
          return new Error(`Prokip API error (${status}): ${data.message || 'Unknown error'}`);
      }
    } else if (error.request) {
      // Network error
      return new Error('Network error connecting to Prokip API. Check connection.');
    } else {
      // Other error
      return error;
    }
  }
  
  /**
   * Connect a new store to Prokip
   */
  async connectStore(storeData) {
    try {
      console.log(`🔗 Connecting store: ${storeData.platform} - ${storeData.storeUrl}`);
      
      const response = await this.client.post('/api/ecom/connect-store', storeData);
      
      return {
        success: true,
        store_id: response.data.store_id,
        message: 'Store connected successfully'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to connect store'
      };
    }
  }
  
  /**
   * Test connection to a store
   */
  async testConnection(storeId) {
    try {
      console.log(`🔍 Testing connection for store: ${storeId}`);
      
      const response = await this.client.post('/api/ecom/test-connection', {
        store_id: storeId
      });
      
      return {
        success: true,
        status: response.data.status || 'connected',
        message: response.data.message || 'Connection successful',
        details: response.data.details || {}
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Connection test failed'
      };
    }
  }
  
  /**
   * Sync products for a store
   */
  async syncProducts(storeId, options = {}) {
    try {
      console.log(`📦 Starting product sync for store: ${storeId}`);
      
      const payload = {
        store_id: storeId,
        ...options
      };
      
      const response = await this.client.post('/api/ecom/sync-products', payload);
      
      return {
        success: true,
        job_id: response.data.job_id || this.generateJobId(),
        status: 'started',
        message: 'Product sync started successfully',
        details: response.data
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to start product sync'
      };
    }
  }
  
  /**
   * Sync orders for a store
   */
  async syncOrders(storeId, options = {}) {
    try {
      console.log(`📋 Starting order sync for store: ${storeId}`);
      
      const payload = {
        store_id: storeId,
        ...options
      };
      
      const response = await this.client.post('/api/ecom/sync-orders', payload);
      
      return {
        success: true,
        job_id: response.data.job_id || this.generateJobId(),
        status: 'started',
        message: 'Order sync started successfully',
        details: response.data
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to start order sync'
      };
    }
  }
  
  /**
   * Get all connected stores
   */
  async getStores() {
    try {
      console.log(`🏪 Fetching all connected stores`);
      
      const response = await this.client.get('/api/ecom/stores');
      
      return {
        success: true,
        stores: response.data.stores || [],
        total: response.data.total || 0
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stores: [],
        total: 0
      };
    }
  }
  
  /**
   * Get sync job status
   */
  async getSyncStatus(jobId) {
    try {
      console.log(`📊 Checking sync status for job: ${jobId}`);
      
      const response = await this.client.get(`/api/ecom/sync-status/${jobId}`);
      
      return {
        success: true,
        ...response.data
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: 'unknown'
      };
    }
  }
  
  /**
   * Generate unique job ID
   */
  generateJobId() {
    return `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }
  
  /**
   * Retry mechanism with exponential backoff
   */
  async retry(operation, maxRetries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        const waitTime = delay * Math.pow(2, attempt - 1);
        console.log(`⚠️ Retry ${attempt}/${maxRetries} in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  /**
   * Validate API key format
   */
  validateApiKey() {
    if (!this.apiKey || typeof this.apiKey !== 'string') {
      throw new Error('Invalid PROKIP_API_KEY format');
    }
    
    if (this.apiKey.length < 10) {
      throw new Error('PROKIP_API_KEY appears to be too short');
    }
    
    return true;
  }
}

module.exports = ProkipService;
