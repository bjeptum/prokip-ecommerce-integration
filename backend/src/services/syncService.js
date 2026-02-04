const prisma = require('../lib/prisma');
const prokipEcomClient = require('./prokipEcomClient');

/**
 * Log sync errors to database for tracking and resolution
 */
async function logSyncError(connectionId, orderId, errorType, errorMessage, errorData = null, operationContext = null) {
  try {
    const errorDetails = {
      originalError: errorMessage,
      errorData: errorData,
      operationContext: operationContext,
      timestamp: new Date().toISOString(),
      recoveryAttempts: 0
    };

    await prisma.syncError.create({
      data: {
        connectionId,
        errorType,
        errorMessage,
        errorDetails: errorData ? JSON.stringify(errorData) : null
      }
    });
    console.error(`[SyncError] ${errorType}: ${errorMessage}`, errorDetails);
    
    // Trigger automatic error recovery for non-critical errors
    if (shouldAttemptAutoRecovery(errorType, errorMessage)) {
      setTimeout(async () => {
        try {
          const errorRecoveryService = require('./errorRecoveryService');
          await errorRecoveryService.processErrorRecovery();
        } catch (recoveryError) {
          console.error('Auto-recovery failed:', recoveryError.message);
        }
      }, 5000); // Wait 5 seconds before attempting recovery
    }
  } catch (err) {
    console.error('Failed to log sync error:', err.message);
  }
}

/**
 * Determine if error should trigger automatic recovery
 */
function shouldAttemptAutoRecovery(errorType, errorMessage) {
  const message = errorMessage.toLowerCase();
  
  // Don't auto-recover critical errors that need manual intervention
  const noAutoRecoveryErrors = [
    'invalid credentials',
    'account suspended',
    'api key revoked',
    'permission denied'
  ];
  
  const shouldNotRecover = noAutoRecoveryErrors.some(error => 
    message.includes(error)
  );
  
  return !shouldNotRecover && ['inventory', 'order', 'product'].includes(errorType);
}

/**
 * Verify payment status before processing order
 */
function isOrderPaid(data, platform) {
  if (platform === 'shopify') {
    // Shopify: check financial_status
    return data.financial_status === 'paid';
  } else if (platform === 'woocommerce') {
    // WooCommerce: check status is completed or processing
    return ['completed', 'processing'].includes(data.status);
  }
  return false;
}


/**
 * Main webhook processing function
 * @param {string} storeUrl - Store URL
 * @param {string} topic - Webhook topic
 * @param {Object} data - Order/webhook data
 * @param {string} platform - Platform (shopify/woocommerce)
 * @param {number} userId - Optional user ID for authentication
 */
async function processStoreToProkip(storeUrl, topic, data, platform, userId = null) {
  try {
    const connection = await prisma.connection.findFirst({ where: { storeUrl } });
    if (!connection) {
      return { success: false, error: `No connection found for store: ${storeUrl}` };
    }

    if (!isOrderPaid(data, platform)) {
      return { success: true, action: 'skipped', reason: 'Order not paid' };
    }

    const response = await prokipEcomClient.syncOrders({
      store_id: connection.id,
      status: data.status || 'processing',
      limit: 1,
      page: 1
    }, userId || connection.userId);

    await prisma.connection.update({
      where: { id: connection.id },
      data: { lastSync: new Date() }
    });

    return { success: true, response };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function pollProkipToStores() {
  console.log('ℹ️ Prokip-to-store polling disabled (using /api/ecom pipeline only).');
}

module.exports = { processStoreToProkip, pollProkipToStores };
