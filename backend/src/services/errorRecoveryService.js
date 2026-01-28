const prisma = require('../lib/prisma');
const { updateInventoryInStore } = require('./storeService');
const prokipService = require('./prokipService');
const { processStoreToProkip } = require('./syncService');

/**
 * Advanced Error Recovery Service
 * Automatically handles and recovers from common sync errors
 */
class ErrorRecoveryService {
  constructor() {
    this.retryStrategies = new Map();
    this.setupRetryStrategies();
  }

  /**
   * Setup retry strategies for different error types
   */
  setupRetryStrategies() {
    // Network timeout errors
    this.retryStrategies.set('NETWORK_TIMEOUT', {
      maxRetries: 3,
      backoffMs: [1000, 2000, 4000],
      action: this.retryWithBackoff.bind(this)
    });

    // Rate limiting errors
    this.retryStrategies.set('RATE_LIMIT', {
      maxRetries: 5,
      backoffMs: [5000, 10000, 20000, 40000, 60000],
      action: this.retryWithBackoff.bind(this)
    });

    // Authentication errors
    this.retryStrategies.set('AUTH_ERROR', {
      maxRetries: 2,
      backoffMs: [1000, 5000],
      action: this.retryWithAuthRefresh.bind(this)
    });

    // Product not found errors
    this.retryStrategies.set('PRODUCT_NOT_FOUND', {
      maxRetries: 1,
      backoffMs: [2000],
      action: this.retryWithProductCreation.bind(this)
    });

    // Inventory sync errors
    this.retryStrategies.set('INVENTORY_SYNC_ERROR', {
      maxRetries: 3,
      backoffMs: [2000, 5000, 10000],
      action: this.retryInventorySync.bind(this)
    });

    // Order processing errors
    this.retryStrategies.set('ORDER_PROCESSING_ERROR', {
      maxRetries: 2,
      backoffMs: [5000, 15000],
      action: this.retryOrderProcessing.bind(this)
    });
  }

  /**
   * Process and attempt to recover from sync errors
   */
  async processErrorRecovery(errorId = null) {
    try {
      const errors = errorId 
        ? await prisma.syncError.findMany({ where: { id: errorId, resolved: false } })
        : await prisma.syncError.findMany({ 
            where: { resolved: false },
            include: { connection: true }
          });

      const recoveryResults = [];

      for (const error of errors) {
        const result = await this.attemptErrorRecovery(error);
        recoveryResults.push(result);
      }

      return {
        success: true,
        processed: recoveryResults.length,
        results: recoveryResults
      };
    } catch (error) {
      console.error('Error recovery process failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Attempt to recover from a specific error
   */
  async attemptErrorRecovery(error) {
    const errorType = this.classifyError(error);
    const strategy = this.retryStrategies.get(errorType);

    if (!strategy) {
      return {
        errorId: error.id,
        success: false,
        message: `No recovery strategy for error type: ${errorType}`,
        requiresManualIntervention: true
      };
    }

    console.log(`Attempting recovery for error ${error.id} (${errorType})`);

    // Update recovery attempt count
    await prisma.syncError.update({
      where: { id: error.id },
      data: {
        recoveryAttempts: error.recoveryAttempts + 1,
        lastRecoveryAt: new Date()
      }
    });

    for (let attempt = 0; attempt < strategy.maxRetries; attempt++) {
      try {
        const delay = strategy.backoffMs[attempt] || 1000;
        if (attempt > 0) {
          await this.sleep(delay);
        }

        const result = await strategy.action(error, attempt);
        
        if (result.success) {
          // Mark error as resolved with auto-recovery
          await prisma.syncError.update({
            where: { id: error.id },
            data: { 
              resolved: true,
              resolvedAt: new Date(),
              autoRecovered: true,
              errorDetails: JSON.stringify({
                originalError: error.errorMessage,
                recoveryAttempts: error.recoveryAttempts + attempt + 1,
                recoveryStrategy: errorType,
                recoveredAt: new Date().toISOString(),
                autoRecovered: true
              })
            }
          });

          return {
            errorId: error.id,
            success: true,
            message: `Recovered successfully after ${attempt + 1} attempts`,
            strategy: errorType,
            attempts: attempt + 1,
            autoRecovered: true
          };
        }
      } catch (attemptError) {
        console.error(`Recovery attempt ${attempt + 1} failed:`, attemptError.message);
        
        if (attempt === strategy.maxRetries - 1) {
          // Last attempt failed, escalate if needed
          const escalationResult = await this.escalateError(error, errorType, attemptError);
          return escalationResult;
        }
      }
    }
  }

  /**
   * Classify error type for appropriate recovery strategy
   */
  classifyError(error) {
    const message = error.errorMessage.toLowerCase();
    const details = error.errorDetails ? JSON.parse(error.errorDetails) : {};

    // Network/timeout errors
    if (message.includes('timeout') || message.includes('network') || message.includes('etimedout')) {
      return 'NETWORK_TIMEOUT';
    }

    // Rate limiting
    if (message.includes('rate limit') || message.includes('too many requests') || message.includes('429')) {
      return 'RATE_LIMIT';
    }

    // Authentication
    if (message.includes('unauthorized') || message.includes('401') || message.includes('authentication')) {
      return 'AUTH_ERROR';
    }

    // Product not found
    if (message.includes('product not found') || message.includes('404') || message.includes('sku not found')) {
      return 'PRODUCT_NOT_FOUND';
    }

    // Inventory sync
    if (error.errorType === 'inventory' || message.includes('inventory sync')) {
      return 'INVENTORY_SYNC_ERROR';
    }

    // Order processing
    if (error.errorType === 'order' || message.includes('order processing')) {
      return 'ORDER_PROCESSING_ERROR';
    }

    // Default classification
    return 'UNKNOWN_ERROR';
  }

  /**
   * Retry with exponential backoff
   */
  async retryWithBackoff(error, attempt) {
    // This is a generic retry - actual implementation depends on error context
    console.log(`Generic retry attempt ${attempt + 1} for error ${error.id}`);
    
    // Try to re-execute the failed operation based on error details
    const details = error.errorDetails ? JSON.parse(error.errorDetails) : {};
    
    if (details.operation === 'inventory_sync') {
      return await this.retryInventorySync(error, attempt);
    } else if (details.operation === 'order_processing') {
      return await this.retryOrderProcessing(error, attempt);
    }

    return { success: false, message: 'No specific retry action available' };
  }

  /**
   * Retry with authentication refresh
   */
  async retryWithAuthRefresh(error, attempt) {
    try {
      const connection = await prisma.connection.findUnique({
        where: { id: parseInt(error.connectionId) },
        include: { user: true }
      });

      if (!connection) {
        return { success: false, message: 'Connection not found' };
      }

      // Refresh Prokip tokens
      if (connection.userId) {
        await prokipService.refreshTokens(connection.userId);
      }

      // Refresh store tokens if needed
      if (connection.platform === 'shopify') {
        // Shopify OAuth tokens don't typically expire, but we can validate
        const shopifyService = require('./shopifyService');
        const isValid = await shopifyService.validateConnection(connection);
        if (!isValid) {
          return { success: false, message: 'Shopify connection requires re-authentication' };
        }
      }

      return { success: true, message: 'Authentication refreshed' };
    } catch (refreshError) {
      return { success: false, message: `Auth refresh failed: ${refreshError.message}` };
    }
  }

  /**
   * Retry with product creation
   */
  async retryWithProductCreation(error, attempt) {
    try {
      const details = error.errorDetails ? JSON.parse(error.errorDetails) : {};
      const { sku, connectionId } = details;

      if (!sku || !connectionId) {
        return { success: false, message: 'Missing SKU or connection details' };
      }

      const connection = await prisma.connection.findUnique({
        where: { id: parseInt(connectionId) }
      });

      if (!connection) {
        return { success: false, message: 'Connection not found' };
      }

      // Try to create the product in the store
      const { createOrUpdateProductInStore } = require('./storeService');
      const result = await createOrUpdateProductInStore(connection, {
        sku,
        name: `Product ${sku}`,
        price: 0,
        quantity: 0
      });

      return { success: true, message: `Product ${sku} created successfully` };
    } catch (createError) {
      return { success: false, message: `Product creation failed: ${createError.message}` };
    }
  }

  /**
   * Retry inventory sync
   */
  async retryInventorySync(error, attempt) {
    try {
      const details = error.errorDetails ? JSON.parse(error.errorDetails) : {};
      const { sku, connectionId, quantity } = details;

      if (!sku || !connectionId) {
        return { success: false, message: 'Missing SKU or connection details' };
      }

      const connection = await prisma.connection.findUnique({
        where: { id: parseInt(connectionId) }
      });

      if (!connection) {
        return { success: false, message: 'Connection not found' };
      }

      // Retry inventory update
      await updateInventoryInStore(connection, sku, quantity || 0);

      return { success: true, message: `Inventory sync successful for ${sku}` };
    } catch (syncError) {
      return { success: false, message: `Inventory sync failed: ${syncError.message}` };
    }
  }

  /**
   * Retry order processing
   */
  async retryOrderProcessing(error, attempt) {
    try {
      const details = error.errorDetails ? JSON.parse(error.errorDetails) : {};
      const { orderId, platform, connectionId, orderData } = details;

      if (!orderId || !platform || !connectionId) {
        return { success: false, message: 'Missing order processing details' };
      }

      const connection = await prisma.connection.findUnique({
        where: { id: parseInt(connectionId) }
      });

      if (!connection) {
        return { success: false, message: 'Connection not found' };
      }

      // Retry order processing
      await processStoreToProkip(connection, orderData, platform);

      return { success: true, message: `Order ${orderId} processed successfully` };
    } catch (processError) {
      return { success: false, message: `Order processing failed: ${processError.message}` };
    }
  }

  /**
   * Escalate error that couldn't be recovered automatically
   */
  async escalateError(error, errorType, lastAttemptError) {
    // Check if this error requires manual intervention
    const requiresManual = this.requiresManualIntervention(errorType, lastAttemptError);

    // Update error with escalation information
    await prisma.syncError.update({
      where: { id: error.id },
      data: {
        errorDetails: JSON.stringify({
          originalError: error.errorMessage,
          escalationReason: lastAttemptError.message,
          requiresManualIntervention: requiresManual,
          escalatedAt: new Date().toISOString(),
          recoveryAttempts: this.retryStrategies.get(errorType)?.maxRetries || 0
        })
      }
    });

    // Create notification for manual intervention if needed
    if (requiresManual) {
      await this.createManualInterventionNotification(error, errorType, lastAttemptError);
    }

    return {
      errorId: error.id,
      success: false,
      message: `Automatic recovery failed after all attempts`,
      requiresManualIntervention: requiresManual,
      escalationReason: lastAttemptError.message,
      nextSteps: requiresManual ? this.getManualInterventionSteps(errorType) : 'Will retry automatically'
    };
  }

  /**
   * Determine if error requires manual intervention
   */
  requiresManualIntervention(errorType, error) {
    const message = error.message.toLowerCase();

    // These errors typically require manual intervention
    const manualInterventionErrors = [
      'invalid credentials',
      'account suspended',
      'api key revoked',
      'store not found',
      'permission denied',
      'configuration error'
    ];

    return manualInterventionErrors.some(manualError => 
      message.includes(manualError)
    );
  }

  /**
   * Create notification for manual intervention
   */
  async createManualInterventionNotification(error, errorType, lastAttemptError) {
    // This would integrate with your notification system
    console.log(`🚨 MANUAL INTERVENTION REQUIRED for error ${error.id}: ${errorType}`);
    console.log(`Error details: ${lastAttemptError.message}`);
    
    // You could send email, Slack notification, or create in-app notification here
  }

  /**
   * Get manual intervention steps
   */
  getManualInterventionSteps(errorType) {
    const steps = {
      'AUTH_ERROR': 'Please re-authenticate the store connection in Settings',
      'PRODUCT_NOT_FOUND': 'Verify the product exists in both systems or create it manually',
      'RATE_LIMIT': 'Wait for rate limit to reset or contact platform support',
      'NETWORK_TIMEOUT': 'Check network connectivity and firewall settings',
      'INVENTORY_SYNC_ERROR': 'Verify product SKUs match between systems',
      'ORDER_PROCESSING_ERROR': 'Check order data format and required fields'
    };

    return steps[errorType] || 'Review error details and contact support if needed';
  }

  /**
   * Sleep utility for delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error recovery statistics
   */
  async getRecoveryStats(connectionId = null) {
    const where = connectionId ? { connectionId: parseInt(connectionId) } : {};
    
    const [total, resolved, unresolved] = await Promise.all([
      prisma.syncError.count({ where }),
      prisma.syncError.count({ where: { ...where, resolved: true } }),
      prisma.syncError.count({ where: { ...where, resolved: false } })
    ]);

    const recentErrors = await prisma.syncError.findMany({
      where: { ...where, resolved: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { connection: true }
    });

    return {
      total,
      resolved,
      unresolved,
      recoveryRate: total > 0 ? (resolved / total * 100).toFixed(2) + '%' : '0%',
      recentErrors: recentErrors.map(error => ({
        id: error.id,
        type: error.errorType,
        message: error.errorMessage,
        createdAt: error.createdAt,
        storeName: error.connection.storeName
      }))
    };
  }
}

module.exports = new ErrorRecoveryService();
