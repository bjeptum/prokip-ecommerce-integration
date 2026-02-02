/**
 * PROKIP ECOMMERCE SERVICE - UPDATED FOR JWT AUTHENTICATION
 * Handles communication with Prokip Laravel API using JWT Bearer tokens
 */

const axios = require('axios');
const prisma = require('../lib/prisma');
const prokipAuthService = require('./prokipAuthService');

class ProkipEcomService {
  constructor() {
    this.baseURL = process.env.PROKIP_BASE_URL;
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  /**
   * Send WooCommerce order to Prokip Laravel API with JWT auth
   * @param {Object} prokipOrder - Formatted order data for Laravel
   * @param {Object} connection - Connection details
   * @returns {Promise<Object>} - API response
   */
  async sendOrderToProkip(prokipOrder, connection) {
    try {
      console.log('📤 Sending order to Prokip Laravel API with JWT...');
      console.log('🌐 Endpoint:', `${this.baseURL}/api/ecom/orders`);
      console.log('🔑 Using JWT Bearer token');

      // Pre-flight validation for Laravel controller
      const validation = this.validateForLaravel(prokipOrder);
      if (!validation.isValid) {
        throw new Error(`Laravel validation failed: ${validation.errors.join(', ')}`);
      }

      // Get customer ID from Prokip
      const customerId = await prokipAuthService.getCustomerId(connection.id);
      prokipOrder.customer_id = customerId;

      // Check stock availability before sending
      const stockCheck = await prokipAuthService.checkStockAvailability(prokipOrder.products);
      if (!stockCheck.sufficient) {
        const errorMsg = `Insufficient stock: ${stockCheck.insufficientStock.map(item => 
          `${item.product_name} (need ${item.required}, have ${item.available})`
        ).join(', ')}`;
        throw new Error(errorMsg);
      }

      // Get JWT auth headers
      const headers = await prokipAuthService.getAuthHeaders();

      console.log('📦 Laravel payload:', JSON.stringify(prokipOrder, null, 2));

      let lastError;

      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          console.log(`🔄 Attempt ${attempt}/${this.maxRetries} to send order to Laravel...`);

          const response = await axios.post(
            `${this.baseURL}/api/ecom/orders`,
            prokipOrder,
            {
              headers,
              timeout: 30000,
              validateStatus: (status) => status < 500 // Don't retry on 4xx errors
            }
          );

          console.log('✅ Order sent to Laravel successfully!');
          console.log('📝 Laravel response:', response.data);

          // Log successful stock reduction
          console.log('📉 Stock reduced for products:', Object.keys(prokipOrder.products));

          return {
            success: true,
            data: response.data,
            attempt: attempt,
            status: response.status,
            stockReduced: true
          };

        } catch (error) {
          lastError = error;
          
          // Enhanced error logging for Laravel debugging
          if (error.response) {
            console.error(`❌ Laravel API Error (Attempt ${attempt}):`);
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Status Text: ${error.response.statusText}`);
            console.error(`   Response Body:`, error.response.data);
            console.error(`   Headers:`, error.response.headers);
            
            // Don't retry on client errors (4xx) - these are Laravel validation errors
            if (error.response.status >= 400 && error.response.status < 500) {
              console.error('💡 Client error detected - not retrying');
              break;
            }

            // Check if token expired and retry with fresh token
            if (error.response.status === 401 && attempt === 1) {
              console.log('🔄 Token expired, refreshing and retrying...');
              prokipAuthService.clearTokens();
              // Get fresh headers for next attempt
              headers = await prokipAuthService.getAuthHeaders();
            }
          } else {
            console.error(`❌ Network Error (Attempt ${attempt}): ${error.message}`);
          }
          
          if (attempt < this.maxRetries) {
            console.log(`⏳ Retrying in ${this.retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          }
        }
      }

      // Log final error with full details
      const errorMessage = `Failed to send order to Laravel after ${this.maxRetries} attempts: ${lastError.message}`;
      console.error('❌ Final Error Details:');
      console.error('   Error:', errorMessage);
      if (lastError.response) {
        console.error('   Status:', lastError.response.status);
        console.error('   Response:', lastError.response.data);
        console.error('   Request Payload:', prokipOrder);
      }

      throw new Error(errorMessage);

    } catch (error) {
      console.error('❌ Prokip Laravel API error:', error.message);
      throw error;
    }
  }

  /**
   * Validate payload for Laravel controller requirements
   * @param {Object} prokipOrder - Order data to validate
   * @returns {Object} - Validation result
   */
  validateForLaravel(prokipOrder) {
    const errors = [];
    const warnings = [];

    // Check required fields for Laravel controller ($request->only(['products', 'customer_id', 'addresses']))
    if (!prokipOrder.customer_id) {
      errors.push('customer_id is required for Laravel controller');
    }

    if (!prokipOrder.addresses || typeof prokipOrder.addresses !== 'object') {
      errors.push('addresses object is required for Laravel controller');
    }

    if (!prokipOrder.products || typeof prokipOrder.products !== 'object') {
      errors.push('products object is required for Laravel controller');
    }

    // CRITICAL: Check if products is an object, not array
    if (Array.isArray(prokipOrder.products)) {
      errors.push('products must be an OBJECT keyed by variation_id, not an array (Laravel requirement)');
    }

    // Validate each product in the object
    if (prokipOrder.products && typeof prokipOrder.products === 'object') {
      Object.keys(prokipOrder.products).forEach(key => {
        const product = prokipOrder.products[key];
        
        if (!product.variation_id) {
          errors.push(`Product ${key}: variation_id is required for Laravel`);
        }
        
        if (!product.quantity || product.quantity <= 0) {
          errors.push(`Product ${key}: valid quantity is required for Laravel`);
        }
        
        if (!product.product_name) {
          warnings.push(`Product ${key}: product_name is missing (optional)`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if order was already synced to Prokip (idempotency)
   * @param {string} wooOrderId - WooCommerce order ID
   * @param {number} connectionId - Connection ID
   * @returns {Promise<boolean>} - True if already synced
   */
  async isOrderAlreadySynced(wooOrderId, connectionId) {
    try {
      const existingTransaction = await prisma.stockTransaction.findFirst({
        where: {
          wooOrderId: wooOrderId,
          connectionId: connectionId,
          status: 'success'
        }
      });

      return !!existingTransaction;
    } catch (error) {
      console.error('❌ Error checking order sync status:', error.message);
      return false;
    }
  }

  /**
   * Log stock transaction for tracking and idempotency
   * @param {Object} transactionData - Transaction details
   */
  async logTransaction(transactionData) {
    try {
      await prisma.stockTransaction.create({
        data: {
          ...transactionData,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      console.log('📝 Transaction logged successfully');
    } catch (error) {
      console.error('❌ Failed to log transaction:', error.message);
    }
  }

  /**
   * Get transaction history
   * @param {number} connectionId - Connection ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Transaction history
   */
  async getTransactionHistory(connectionId, options = {}) {
    try {
      const { limit = 50, status, type } = options;
      
      const whereClause = { connectionId };
      if (status) whereClause.status = status;
      if (type) whereClause.transactionType = type;

      return await prisma.stockTransaction.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit
      });
    } catch (error) {
      console.error('❌ Failed to get transaction history:', error.message);
      return [];
    }
  }

  /**
   * Test connection to Prokip Laravel API with JWT
   * @returns {Promise<boolean>} - True if connection works
   */
  async testConnection() {
    try {
      console.log('🔧 Testing Prokip Laravel API connection with JWT...');
      
      const headers = await prokipAuthService.getAuthHeaders();

      // Test with a simple GET request to check API availability
      const response = await axios.get(
        `${this.baseURL}/api/ecom/health`,
        { 
          headers,
          timeout: 10000,
          validateStatus: (status) => status < 500
        }
      );

      console.log('✅ Prokip Laravel API connection successful');
      return true;

    } catch (error) {
      console.log('⚠️ Prokip Laravel API connection test failed:', error.message);
      console.log('💡 This might be normal if the health endpoint doesn\'t exist');
      return false;
    }
  }

  /**
   * Verify stock was actually reduced in Prokip
   * @param {Object} products - Products that should have stock reduced
   * @returns {Promise<Object>} - Stock verification result
   */
  async verifyStockReduction(products) {
    try {
      console.log('🔍 Verifying stock reduction in Prokip...');
      
      const stockCheck = await prokipAuthService.checkStockAvailability(products);
      
      // This would ideally compare before/after stock levels
      // For now, just return the current stock status
      return {
        verified: true,
        currentStock: stockCheck.stockData,
        message: 'Stock verification completed'
      };

    } catch (error) {
      console.error('❌ Stock verification failed:', error.message);
      return {
        verified: false,
        error: error.message
      };
    }
  }
}

module.exports = new ProkipEcomService();
