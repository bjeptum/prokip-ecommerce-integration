/**
 * WooCommerce Inventory Sync Webhook Handler
 * 
 * FOCUSED HANDLER - Only handles inventory synchronization
 * Uses existing authentication and Prokip services
 * Implements idempotency and proper error handling
 */

const { shouldReduceStock } = require('./wooToProkipStockMapper');
const { syncWooOrderToProkip, invalidateSkuMapForUser, buildInvoiceNumber } = require('./prokipEcomOrderSyncService');
const prisma = require('../lib/prisma');
const { getWooProducts } = require('./wooService');
const prokipLocalAuthService = require('./prokipLocalAuthService');
const { decryptCredentials } = require('./storeService');

function normalizeKey(value) {
  return (value || '').toString().trim().toLowerCase();
}

/**
 * Handle WooCommerce order webhook for inventory synchronization
 * @param {Object} wooOrder - WooCommerce order object
 * @param {Object} webhookHeaders - Webhook headers
 * @param {number} userId - User ID for authentication
 * @returns {Promise<Object>} - Processing result
 */
async function handleWooCommerceInventorySync(wooOrder, webhookHeaders, userId = null) {
  const orderId = wooOrder?.id?.toString();
  const topic = webhookHeaders?.['x-wc-webhook-topic'] || 'order.created';
  const source = webhookHeaders?.['x-wc-webhook-source'];

  console.log(`🔔 WooCommerce inventory sync webhook received:`);
  console.log(`  - Order ID: ${orderId}`);
  console.log(`  - Topic: ${topic}`);
  console.log(`  - Source: ${source}`);
  console.log(`  - User ID: ${userId}`);

  try {
    // STEP 1: Validate order status
    if (!shouldReduceStock(wooOrder)) {
      console.log(`⏭️ Order ${orderId} status not eligible for stock reduction`);
      return {
        success: true,
        action: 'skipped',
        reason: 'Order status not eligible for stock reduction',
        orderId,
        status: wooOrder.status
      };
    }

    // STEP 2: Find connection for this store (prefer the calling user)
    let connection = null;
    if (source) {
      const sourceTrimmed = source.toString().trim().replace(/\/+$/, '');
      const candidates = Array.from(new Set([source.toString().trim(), sourceTrimmed]));

      connection = await prisma.connection.findFirst({
        where: {
          ...(userId ? { userId } : {}),
          OR: candidates.map((value) => ({ storeUrl: value }))
        }
      });

      if (!connection) {
        try {
          const withScheme = sourceTrimmed.startsWith('http') ? sourceTrimmed : `https://${sourceTrimmed}`;
          const url = new URL(withScheme);
          const origin = url.origin.toLowerCase();
          const hostname = url.hostname.toLowerCase();

          connection = await prisma.connection.findFirst({
            where: {
              ...(userId ? { userId } : {}),
              OR: [
                { storeUrl: { startsWith: origin } },
                { storeUrl: { contains: hostname } }
              ]
            }
          });
        } catch {
          // ignore URL parse errors
        }
      }
    }

    if (!connection) {
      // Fallback to any WooCommerce connection (prefer the calling user)
      connection = await prisma.connection.findFirst({
        where: {
          ...(userId ? { userId } : {}),
          platform: 'woocommerce'
        }
      });
    }

    if (!connection) {
      console.log(`⚠️ No WooCommerce connection found for order ${orderId}`);
      return {
        success: false,
        action: 'error',
        reason: 'No WooCommerce connection found',
        orderId
      };
    }

    console.log(`✅ Found connection: ${connection.id} for store: ${connection.storeUrl}`);

    // STEP 3: Check idempotency - prevent duplicate processing
    const existingLog = await prisma.salesLog.findFirst({
      where: {
        connectionId: connection.id,
        orderId: orderId
      }
    });

    if (existingLog) {
      console.log(`⏭️ Order ${orderId} already processed (SalesLog ID: ${existingLog.id}), skipping duplicate`);
      return {
        success: true,
        action: 'skipped',
        reason: 'Order already processed',
        orderId,
        existingLogId: existingLog.id,
        processedAt: existingLog.syncedAt
      };
    }

    // STEP 4: Send order to Prokip via /api/ecom/orders
    console.log(`📦 Sending order ${orderId} to Prokip /api/ecom/orders...`);
    let prokipResult = await syncWooOrderToProkip(
      wooOrder,
      connection,
      userId || connection.userId
    );

    if (!prokipResult || prokipResult.success === false) {
      console.log(`❌ Failed to sync order ${orderId} via /api/ecom/orders:`, prokipResult?.error);

      await logInventoryError(
        connection.id,
        orderId,
        'prokip_sync_failed',
        `Failed to sync order via /api/ecom/orders: ${prokipResult?.error || 'Unknown error'}`,
        { prokipResult }
      );

      return {
        success: false,
        action: 'error',
        reason: 'Failed to sync order via /api/ecom/orders',
        orderId,
        error: prokipResult?.error
      };
    }

    const prokipResponse = prokipResult.response || prokipResult;
    const invoiceNo =
      prokipResult.invoiceNo ||
      buildInvoiceNumber('woocommerce', wooOrder.number, orderId);
    const totalQuantity =
      prokipResult.totalQuantity ||
      wooOrder.line_items?.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0) ||
      0;

    // STEP 5: Record successful processing in SalesLog
    const salesLog = await prisma.salesLog.create({
      data: {
        connectionId: connection.id,
        orderId: orderId,
        orderNumber: wooOrder.number?.toString(),
        invoiceNo,
        platform: 'woocommerce',
        customerName: wooOrder.billing?.first_name && wooOrder.billing?.last_name ? 
          `${wooOrder.billing.first_name} ${wooOrder.billing.last_name}` : 
          wooOrder.billing?.email || 'Unknown',
        customerEmail: wooOrder.billing?.email,
        totalAmount: parseFloat(wooOrder.total || 0),
        status: wooOrder.status,
        orderDate: new Date(wooOrder.date_created || Date.now()),
        prokipSellId: null,
        stockDeducted: true
      }
    });

    console.log(`✅ Successfully processed order ${orderId}:`);
    console.log(`  - SalesLog ID: ${salesLog.id}`);
    console.log(`  - Prokip Sync Result: ${prokipResponse.message || 'OK'}`);

    return {
      success: true,
      action: 'processed',
      orderId,
      salesLogId: salesLog.id,
      prokipSellId: null,
      itemsProcessed: wooOrder.line_items?.length || 0,
      totalQuantity,
      totalAmount: parseFloat(wooOrder.total || 0)
    };

  } catch (error) {
    console.error(`❌ Unexpected error processing order ${orderId}:`, error.message);
    console.error('Stack:', error.stack);

    // Log unexpected error
    try {
      const connection = source ? 
        await prisma.connection.findFirst({ where: { storeUrl: source } }) :
        await prisma.connection.findFirst({ where: { platform: 'woocommerce' } });

      if (connection) {
        await logInventoryError(connection.id, orderId, 'unexpected_error', 
          error.message, { stack: error.stack, wooOrder, webhookHeaders });
      }
    } catch (logError) {
      console.error('Failed to log error:', logError.message);
    }

    return {
      success: false,
      action: 'error',
      reason: 'Unexpected error',
      orderId,
      error: error.message
    };
  }
}

/**
 * Log inventory synchronization errors
 * @param {number} connectionId - Connection ID
 * @param {string} orderId - Order ID
 * @param {string} errorType - Error type
 * @param {string} errorMessage - Error message
 * @param {Object} errorDetails - Additional error details
 */
async function logInventoryError(connectionId, orderId, errorType, errorMessage, errorDetails = null) {
  try {
    await prisma.syncError.create({
      data: {
        connectionId,
        orderId,
        errorType,
        errorMessage,
        errorDetails: errorDetails ? JSON.stringify(errorDetails) : null,
        severity: 'high'
      }
    });
    console.error(`[InventoryError] ${errorType} for order ${orderId}: ${errorMessage}`);
  } catch (logError) {
    console.error('Failed to log inventory error:', logError.message);
  }
}

/**
 * Get inventory sync statistics
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Statistics
 */
async function getInventorySyncStats(userId = null) {
  try {
    const whereClause = userId ? { connection: { userId } } : {};

    const totalOrders = await prisma.salesLog.count({
      where: {
        ...whereClause,
        platform: 'woocommerce'
      }
    });

    const successfulSyncs = await prisma.salesLog.count({
      where: {
        ...whereClause,
        platform: 'woocommerce',
        stockDeducted: true
      }
    });

    const recentErrors = await prisma.syncError.count({
      where: {
        ...whereClause,
        errorType: { contains: 'inventory' },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      }
    });

    return {
      totalOrders,
      successfulSyncs,
      recentErrors,
      successRate: totalOrders > 0 ? (successfulSyncs / totalOrders * 100).toFixed(2) + '%' : '0%'
    };
  } catch (error) {
    console.error('Failed to get inventory sync stats:', error.message);
    return {
      totalOrders: 0,
      successfulSyncs: 0,
      recentErrors: 0,
      successRate: '0%'
    };
  }
}

module.exports = {
  handleWooCommerceInventorySync,
  logInventoryError,
  getInventorySyncStats
};
