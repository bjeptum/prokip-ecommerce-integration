const { PrismaClient } = require('@prisma/client');
const ProkipUserAuthService = require('./prokipUserAuthService');
const WooCommerceToProkipMapper = require('./wooToProkipMapper');

const prisma = new PrismaClient();

class WooToProkipUserService {
  constructor() {
    this.authService = new ProkipUserAuthService();
    this.mapper = new WooCommerceToProkipMapper();
  }

  /**
   * Process WooCommerce order for specific user
   * @param {string} userId - User ID from your system
   * @param {Object} wooOrder - WooCommerce order data
   * @returns {Promise<Object>} Processing result
   */
  async processOrderForUser(userId, wooOrder) {
    const startTime = Date.now();
    let transactionId = null;
    let connectionId = null;

    try {
      console.log(`🛒 Processing WooCommerce order ${wooOrder.id} for user ${userId}`);

      // Get user's Prokip connection
      const connection = await this.authService.getUserConnection(userId);
      if (!connection) {
        throw new Error(`No active Prokip connection found for user ${userId}`);
      }
      connectionId = connection.id;

      // Log webhook received
      await this.logWebhook(userId, connectionId, 'order.created', wooOrder.id, wooOrder);

      // Check if order already processed (idempotency)
      const existingTransaction = await prisma.stockTransaction.findFirst({
        where: {
          connectionId: connectionId,
          wooOrderId: wooOrder.id.toString()
        }
      });

      if (existingTransaction) {
        console.log(`⚠️ Order ${wooOrder.id} already processed for user ${userId}`);
        return {
          success: true,
          alreadyProcessed: true,
          transactionId: existingTransaction.id,
          message: 'Order already processed'
        };
      }

      // Create initial transaction record
      const transaction = await prisma.stockTransaction.create({
        data: {
          userId: userId,
          connectionId: connectionId,
          wooOrderId: wooOrder.id.toString(),
          wooOrderNumber: wooOrder.number || wooOrder.id.toString(),
          customerInfo: this.extractCustomerInfo(wooOrder),
          products: {}, // Will be populated after mapping
          totalAmount: parseFloat(wooOrder.total || 0),
          status: 'pending'
        }
      });
      transactionId = transaction.id;

      // Map WooCommerce order to Prokip format
      const prokipOrder = await this.mapper.mapOrderToProkip(wooOrder, { prokipCustomerId: await this.authService.getUserProkipCustomerId(userId) });
      
      // Update transaction with mapped products
      await prisma.stockTransaction.update({
        where: { id: transactionId },
        data: {
          products: prokipOrder.products
        }
      });

      // Check stock availability before sending order
      if (process.env.ENABLE_STOCK_CHECK !== 'false') {
        const stockCheck = await this.checkStockAvailability(userId, prokipOrder.products);
        
        if (!stockCheck.allAvailable) {
          const unavailableItems = stockCheck.stockChecks.filter(item => !item.available);
          throw new Error(`Insufficient stock for items: ${unavailableItems.map(item => item.sku).join(', ')}`);
        }
      }

      // Send order to Prokip using user's JWT token
      const prokipResponse = await this.sendOrderToProkip(userId, prokipOrder);

      // Update transaction with success
      await prisma.stockTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'completed',
          transactionId: prokipResponse.transaction_id,
          receiptNumber: prokipResponse.receipt_number,
          stockAfter: prokipResponse.stock_levels,
          itemsDeducted: prokipResponse.items_deducted,
          processedAt: new Date(),
          errorMessage: null
        }
      });

      // Update connection's last sync
      await prisma.prokipConnection.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date() }
      });

      const processingTime = Date.now() - startTime;
      
      console.log(`✅ Order ${wooOrder.id} processed successfully for user ${userId} in ${processingTime}ms`);

      // Log API usage
      await this.logApiUsage(userId, connectionId, '/api/ecom/orders', 'POST', 200, processingTime, true);

      return {
        success: true,
        transactionId: transactionId,
        prokipTransactionId: prokipResponse.transaction_id,
        receiptNumber: prokipResponse.receipt_number,
        stockDeducted: prokipResponse.items_deducted,
        processingTime
      };

    } catch (error) {
      console.error(`❌ Failed to process order ${wooOrder.id} for user ${userId}:`, error.message);

      // Update transaction with error
      if (transactionId) {
        await prisma.stockTransaction.update({
          where: { id: transactionId },
          data: {
            status: 'failed',
            errorMessage: error.message,
            retryCount: { increment: 1 }
          }
        });
      }

      // Log failed sync for manual review
      await this.logFailedSync(userId, connectionId, wooOrder.id, wooOrder, error);

      // Log webhook failure
      if (connectionId) {
        await this.logWebhook(userId, connectionId, 'order.created', wooOrder.id, wooOrder, false, error.message);
      }

      // Log API usage
      const processingTime = Date.now() - startTime;
      if (connectionId) {
        await this.logApiUsage(userId, connectionId, '/api/ecom/orders', 'POST', 500, processingTime, false, error.message);
      }

      // Determine if we should retry
      const shouldRetry = this.shouldRetryError(error);
      
      if (shouldRetry && transactionId) {
        // Schedule retry for network errors
        const nextRetryAt = new Date(Date.now() + (60 * 1000)); // 1 minute from now
        await prisma.stockTransaction.update({
          where: { id: transactionId },
          data: {
            status: 'retry',
            nextRetryAt: nextRetryAt
          }
        });
      }

      throw error;
    }
  }

  /**
   * Send order to Prokip using user's JWT token
   * @param {string} userId - User ID
   * @param {Object} prokipOrder - Mapped order data
   * @returns {Promise<Object>} Prokip response
   */
  async sendOrderToProkip(userId, prokipOrder) {
    try {
      const response = await this.authService.makeAuthenticatedCall(
        userId,
        '/api/ecom/orders',
        prokipOrder,
        'POST'
      );

      return response;

    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Authentication expired. Please reconnect your Prokip account.');
      } else if (error.response?.status === 400) {
        throw new Error(`Invalid order data: ${error.response.data.message || error.message}`);
      } else if (error.response?.status === 500) {
        throw new Error(`Prokip server error: ${error.response.data.message || 'Internal server error'}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Check stock availability for user
   * @param {string} userId - User ID
   * @param {Object} products - Products object (keyed by variation_id)
   * @returns {Promise<Object>} Stock availability result
   */
  async checkStockAvailability(userId, products) {
    const items = Object.values(products).map(product => ({
      sku: product.sku || product.variation_id.toString(),
      quantity: product.quantity
    }));

    return await this.authService.checkStockAvailability(userId, items);
  }

  /**
   * Extract customer information from WooCommerce order
   * @param {Object} wooOrder - WooCommerce order
   * @returns {Object} Customer information
   */
  extractCustomerInfo(wooOrder) {
    const billing = wooOrder.billing || {};
    const shipping = wooOrder.shipping || {};

    return {
      firstName: billing.first_name || '',
      lastName: billing.last_name || '',
      email: billing.email || '',
      phone: billing.phone || shipping.phone || '',
      billing: {
        address1: billing.address_1 || '',
        address2: billing.address_2 || '',
        city: billing.city || '',
        state: billing.state || '',
        postcode: billing.postcode || '',
        country: billing.country || ''
      },
      shipping: {
        address1: shipping.address_1 || billing.address_1 || '',
        address2: shipping.address_2 || billing.address_2 || '',
        city: shipping.city || billing.city || '',
        state: shipping.state || billing.state || '',
        postcode: shipping.postcode || billing.postcode || '',
        country: shipping.country || billing.country || ''
      }
    };
  }

  /**
   * Log webhook received
   * @param {string} userId - User ID
   * @param {string} connectionId - Connection ID
   * @param {string} webhookType - Webhook type
   * @param {string} wooOrderId - WooCommerce order ID
   * @param {Object} payload - Webhook payload
   * @param {boolean} success - Processing success
   * @param {string} errorMessage - Error message if failed
   */
  async logWebhook(userId, connectionId, webhookType, wooOrderId, payload, success = null, errorMessage = null) {
    try {
      await prisma.webhookLog.create({
        data: {
          userId: userId,
          connectionId: connectionId,
          webhookType: webhookType,
          wooOrderId: wooOrderId?.toString(),
          payload: payload,
          processed: success !== null,
          success: success,
          errorMessage: errorMessage
        }
      });
    } catch (error) {
      console.error('Failed to log webhook:', error.message);
    }
  }

  /**
   * Log API usage for monitoring
   * @param {string} userId - User ID
   * @param {string} connectionId - Connection ID
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {number} statusCode - Response status code
   * @param {number} responseTime - Response time in ms
   * @param {boolean} success - Success status
   * @param {string} errorMessage - Error message if failed
   */
  async logApiUsage(userId, connectionId, endpoint, method, statusCode, responseTime, success, errorMessage = null) {
    try {
      await prisma.apiUsage.create({
        data: {
          userId: userId,
          connectionId: connectionId,
          endpoint: endpoint,
          method: method,
          statusCode: statusCode,
          responseTime: responseTime,
          success: success,
          errorMessage: errorMessage
        }
      });
    } catch (error) {
      console.error('Failed to log API usage:', error.message);
    }
  }

  /**
   * Log failed sync for manual review
   * @param {string} userId - User ID
   * @param {string} connectionId - Connection ID
   * @param {string} wooOrderId - WooCommerce order ID
   * @param {Object} payload - Order payload
   * @param {Error} error - Error object
   */
  async logFailedSync(userId, connectionId, wooOrderId, payload, error) {
    try {
      const errorType = this.getErrorType(error);
      const nextRetryAt = this.shouldRetryError(error) ? new Date(Date.now() + (60 * 1000)) : null;

      await prisma.failedSync.create({
        data: {
          userId: userId,
          connectionId: connectionId,
          wooOrderId: wooOrderId.toString(),
          payload: payload,
          errorType: errorType,
          errorMessage: error.message,
          nextRetryAt: nextRetryAt
        }
      });
    } catch (logError) {
      console.error('Failed to log failed sync:', logError.message);
    }
  }

  /**
   * Determine error type for categorization
   * @param {Error} error - Error object
   * @returns {string} Error type
   */
  getErrorType(error) {
    if (error.message.includes('Authentication') || error.message.includes('token')) {
      return 'authentication';
    } else if (error.message.includes('stock') || error.message.includes('Insufficient')) {
      return 'stock';
    } else if (error.message.includes('Invalid') || error.message.includes('validation')) {
      return 'validation';
    } else if (error.message.includes('network') || error.message.includes('timeout')) {
      return 'network';
    } else {
      return 'unknown';
    }
  }

  /**
   * Determine if error should be retried
   * @param {Error} error - Error object
   * @returns {boolean} Whether to retry
   */
  shouldRetryError(error) {
    const retryableErrors = [
      'network',
      'timeout',
      'ECONNRESET',
      'ETIMEDOUT'
    ];

    return retryableErrors.some(retryableError => 
      error.message.toLowerCase().includes(retryableError.toLowerCase())
    );
  }

  /**
   * Get user's transaction history
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Transaction history
   */
  async getUserTransactionHistory(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      status = null,
      startDate = null,
      endDate = null
    } = options;

    const where = {
      userId: userId
    };

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      prisma.stockTransaction.findMany({
        where: where,
        include: {
          connection: {
            select: {
              connectionName: true,
              prokipEmail: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.stockTransaction.count({ where: where })
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get user's failed syncs
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Failed syncs
   */
  async getUserFailedSyncs(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      resolved = false
    } = options;

    const where = {
      userId: userId,
      resolved: resolved
    };

    const [failedSyncs, total] = await Promise.all([
      prisma.failedSync.findMany({
        where: where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.failedSync.count({ where: where })
    ]);

    return {
      failedSyncs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Retry failed transaction
   * @param {string} userId - User ID
   * @param {string} transactionId - Transaction ID to retry
   * @returns {Promise<Object>} Retry result
   */
  async retryTransaction(userId, transactionId) {
    try {
      const transaction = await prisma.stockTransaction.findFirst({
        where: {
          id: transactionId,
          userId: userId,
          status: 'failed'
        },
        include: {
          connection: true
        }
      });

      if (!transaction) {
        throw new Error('Transaction not found or not eligible for retry');
      }

      // Reconstruct WooCommerce order from transaction data
      const wooOrder = this.reconstructWooOrder(transaction);

      // Process the order again
      return await this.processOrderForUser(userId, wooOrder);

    } catch (error) {
      console.error(`❌ Failed to retry transaction ${transactionId}:`, error.message);
      throw error;
    }
  }

  /**
   * Reconstruct WooCommerce order from transaction data
   * @param {Object} transaction - Transaction data
   * @returns {Object} Reconstructed WooCommerce order
   */
  reconstructWooOrder(transaction) {
    // This is a simplified reconstruction
    // In a real implementation, you might store the full original order
    return {
      id: parseInt(transaction.wooOrderId),
      number: transaction.wooOrderNumber,
      total: transaction.totalAmount.toString(),
      billing: transaction.customerInfo?.billing || {},
      shipping: transaction.customerInfo?.shipping || {},
      // Add other necessary fields based on your needs
    };
  }
}

module.exports = WooToProkipUserService;
