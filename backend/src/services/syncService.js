const axios = require('axios');
const prisma = require('../lib/prisma');
const { updateInventoryInStore } = require('./storeService');
const { mapOrderToProkipSell, mapRefundToProkipProducts, mapCancellationProducts } = require('./prokipMapper');
const prokipService = require('./prokipService');
const MOCK_PROKIP = process.env.MOCK_PROKIP === 'true';
const PROKIP_BASE = MOCK_PROKIP 
  ? (process.env.MOCK_PROKIP_URL || 'http://localhost:4000') + '/connector/api/'
  : process.env.PROKIP_API + '/connector/api/';

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
        orderId: orderId?.toString(),
        errorType,
        errorMessage,
        errorDetails: JSON.stringify(errorDetails)
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
 * Get Prokip headers - uses prokipService for real API, falls back to direct config for mocks
 * @param {number} userId - User ID (optional)
 */
async function getProkipHeaders(userId = null) {
  if (!MOCK_PROKIP) {
    // Use prokipService for real API (handles token refresh automatically)
    return await prokipService.getAuthHeaders(userId);
  }
  
  // For mocks, use direct config
  const prokip = await prisma.prokipConfig.findFirst({ where: { userId: userId || 50 } });
  if (!prokip || !prokip.token) {
    throw new Error('Prokip not configured');
  }
  
  return {
    Authorization: `Bearer ${prokip.token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
}

/**
 * Restore inventory for cancelled order (full restoration)
 */
async function restoreInventoryForCancellation(connection, data, platform, prokipHeaders) {
  const orderId = (data.id || data.number)?.toString();
  const log = await prisma.salesLog.findFirst({ 
    where: { 
      connectionId: connection.id,
      orderId 
    } 
  });

  if (!log?.prokipSellId) {
    console.log(`No sale record found for cancelled order ${orderId}, skipping inventory restoration`);
    return;
  }

  // Get all products from the original order
  const products = mapCancellationProducts(data, platform);
  
  if (products.length === 0) {
    console.log('No products to restore for cancellation');
    return;
  }

  // Restore inventory in Prokip via sell-return
  const returnBody = {
    transaction_id: log.prokipSellId,
    transaction_date: new Date().toISOString(),
    products,
    discount_amount: 0,
    discount_type: 'fixed'
  };

  try {
    await axios.post(PROKIP_BASE + 'sell-return', returnBody, { headers: prokipHeaders });
    console.log(`✓ Inventory restored in Prokip for cancelled order ${orderId}`);
    
    // Restore inventory in store and cache
    for (const product of products) {
      await restoreInventoryInStoreAndCache(connection, product.sku, product.quantity);
    }
  } catch (error) {
    await logSyncError(
      connection.id,
      orderId,
      'cancellation_failed',
      'Failed to restore inventory for cancellation',
      { error: error.response?.data || error.message, returnBody }
    );
    throw error;
  }
}

/**
 * Process partial refund (only refunded items)
 */
async function processPartialRefund(connection, data, platform, prokipHeaders) {
  const orderId = (data.id || data.number)?.toString();
  const log = await prisma.salesLog.findFirst({ 
    where: { 
      connectionId: connection.id,
      orderId 
    } 
  });

  if (!log?.prokipSellId) {
    console.log(`No sale record found for refunded order ${orderId}, skipping`);
    return;
  }

  const refundedProducts = mapRefundToProkipProducts(data, platform);
  
  if (refundedProducts.length === 0) {
    console.log('No products to refund');
    return;
  }

  const returnBody = {
    transaction_id: log.prokipSellId,
    transaction_date: new Date().toISOString(),
    products: refundedProducts,
    discount_amount: 0,
    discount_type: 'fixed'
  };

  try {
    await axios.post(PROKIP_BASE + 'sell-return', returnBody, { headers: prokipHeaders });
    console.log(`✓ Refund processed in Prokip for order ${orderId}`);
    
    // Restore inventory for refunded items
    for (const product of refundedProducts) {
      await restoreInventoryInStoreAndCache(connection, product.sku, product.quantity);
    }
  } catch (error) {
    await logSyncError(
      connection.id,
      orderId,
      'refund_failed',
      'Failed to process refund in Prokip',
      { error: error.response?.data || error.message, returnBody }
    );
    throw error;
  }
}

/**
 * Restore inventory in store and update cache
 */
async function restoreInventoryInStoreAndCache(connection, sku, quantity) {
  try {
    // Update inventory log
    const inventoryLog = await prisma.inventoryLog.findFirst({
      where: { 
        connectionId: connection.id,
        sku 
      }
    });

    if (inventoryLog) {
      const newQuantity = inventoryLog.quantity + quantity;
      await prisma.inventoryLog.update({
        where: { id: inventoryLog.id },
        data: { 
          quantity: newQuantity,
          lastSynced: new Date()
        }
      });
      
      // Update store inventory
      await updateInventoryInStore(connection, sku, newQuantity);
      console.log(`✓ Restored ${quantity} units of SKU ${sku} (new total: ${newQuantity})`);
    } else {
      console.log(`⚠️ No inventory log found for SKU ${sku}, skipping store update`);
    }
  } catch (error) {
    console.error(`Failed to restore inventory for SKU ${sku}:`, error.message);
    await logSyncError(
      connection.id,
      null,
      'inventory_restore_failed',
      `Failed to restore inventory for SKU ${sku}`,
      { error: error.message, sku, quantity }
    );
  }
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
  // Check Prokip authentication - for real API, use prokipService
  let prokip;
  let headers;
  
  try {
    if (!MOCK_PROKIP) {
      // Real API - check authentication via service
      console.log(`🔐 Checking Prokip authentication for userId: ${userId}`);
      const isAuthenticated = await prokipService.isAuthenticated(userId);
      if (!isAuthenticated) {
        console.error('Not authenticated with Prokip. Please log in first.');
        return;
      }
      console.log(`✅ Prokip authenticated, getting config for userId: ${userId}`);
      prokip = await prokipService.getProkipConfig(userId);
      console.log(`✅ Getting Prokip headers for userId: ${userId}`);
      headers = await getProkipHeaders(userId);
    } else {
      // Mock mode - use direct config
      console.log(`🔧 Mock mode, getting config for userId: ${userId || 50}`);
      prokip = await prisma.prokipConfig.findFirst({ where: { userId: userId || 50 } });
      if (!prokip || !prokip.token || !prokip.locationId) {
        console.error('Prokip config not found or incomplete');
        return;
      }
      headers = {
        Authorization: `Bearer ${prokip.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      };
    }
  } catch (error) {
    console.error('Failed to get Prokip authentication:', error.message);
    return;
  }

  if (!prokip?.locationId) {
    console.error('Prokip location not configured');
    return;
  }

  const connection = await prisma.connection.findFirst({ where: { storeUrl } });
  if (!connection) {
    console.error(`No connection found for store: ${storeUrl}`);
    return;
  }

  const orderId = (data.id || data.number)?.toString();

  // HANDLE ORDER CREATION / PAYMENT
  if (topic.includes('order/create') || topic.includes('orders/create') || 
      topic.includes('order/paid') || topic.includes('orders/paid') || 
      topic === 'order.created' || topic === 'order.updated') {
    
    // For orders/updated, check if it's a refund (has refunds array)
    if (topic.includes('orders/updated') && data.refunds && data.refunds.length > 0) {
      // This is actually a refund, handle it below
      console.log(`Order ${orderId} updated with refund, processing as refund`);
    } else {
      // CRITICAL: Verify payment before processing
      if (!isOrderPaid(data, platform)) {
        console.log(`Order ${orderId} is not paid yet (status: ${data.financial_status || data.status}), skipping`);
        return;
      }

      // CRITICAL: Check for duplicate processing (idempotency)
      const existingLog = await prisma.salesLog.findFirst({
        where: { 
          connectionId: connection.id,
          orderId 
        }
      });

      if (existingLog) {
        console.log(`Order ${orderId} already processed (SalesLog ID: ${existingLog.id}), skipping duplicate`);
        return;
      }

      // Map order to Prokip sell format
      const sellBody = await mapOrderToProkipSell(data, prokip.locationId, platform);
      if (!sellBody) {
        await logSyncError(
          connection.id,
          orderId,
          'mapping_failed',
          'Failed to map order to Prokip sell format',
          { orderData: data }
        );
        return;
      }

      // Validate inventory availability
      const lineItems = platform === 'shopify' ? data.line_items : data.line_items;
      for (const item of lineItems || []) {
        if (item.sku) {
          const inventoryLog = await prisma.inventoryLog.findFirst({
            where: { 
              connectionId: connection.id,
              sku: item.sku 
            }
          });
          
          if (cache && cache.quantity < item.quantity) {
            await logSyncError(
              connection.id,
              orderId,
              'insufficient_inventory',
              `Insufficient inventory for SKU ${item.sku}: available=${cache.quantity}, required=${item.quantity}`,
              { sku: item.sku, available: cache.quantity, required: item.quantity }
            );
            console.warn(`⚠️ Insufficient inventory for SKU ${item.sku}, but continuing with sale`);
          }
        }
      }

      // Record sale in Prokip
      try {
        const response = await axios.post(PROKIP_BASE + 'sell', sellBody, { headers });
        const prokipSellId = response.data?.data?.[0]?.id || response.data?.id || null;
        
        await prisma.salesLog.create({
          data: {
            connectionId: connection.id,
            orderId,
            orderNumber: data.order_number || data.number?.toString(),
            invoiceNo: invoiceNo,
            platform: platform,
            customerName: data.customer?.first_name || data.billing?.first_name || 'Guest',
            customerEmail: data.customer?.email || data.billing?.email,
            totalAmount: parseFloat(data.total || data.total_price || 0),
            status: 'completed',
            orderDate: new Date(data.created_at || data.date_created),
            prokipSellId: prokipSellId
          }
        });
        console.log(`✓ Sale recorded in Prokip for order ${orderId}${prokipSellId ? ` (Prokip ID: ${prokipSellId})` : ''}`);
      } catch (error) {
        await logSyncError(
          connection.id,
          orderId,
          'sale_failed',
          'Failed to record sale in Prokip',
          { error: error.response?.data || error.message, sellBody }
        );
        console.error('Prokip sell failed:', error.response?.data || error.message);
      }
    }
  } 
  // HANDLE ORDER CANCELLATION
  else if (topic.includes('order/cancelled') || topic.includes('orders/cancelled')) {
    console.log(`Processing cancellation for order ${orderId}`);
    try {
      await restoreInventoryForCancellation(connection, data, platform, headers);
    } catch (error) {
      console.error('Cancellation processing failed:', error.message);
    }
  }
  // HANDLE REFUND
  else if (topic.includes('refund') || topic.includes('order.refunded') || 
           (topic.includes('orders/updated') && data.refunds && data.refunds.length > 0)) {
    console.log(`Processing refund for order ${orderId}`);
    try {
      await processPartialRefund(connection, data, platform, headers);
    } catch (error) {
      console.error('Refund processing failed:', error.message);
    }
  }

  // Update last sync timestamp
  await prisma.connection.update({
    where: { id: connection.id },
    data: { lastSync: new Date() }
  });
}

async function pollProkipToStores() {
  let headers;
  let stockData;
  
  try {
    if (!MOCK_PROKIP) {
      // Real API - use prokipService
      const isAuthenticated = await prokipService.isAuthenticated(50); // Use default userId
      if (!isAuthenticated) {
        console.log('Not authenticated with Prokip, skipping sync poll');
        return;
      }
      
      console.log('🔍 Calling prokipService.getInventory(50)...');
      stockData = await prokipService.getInventory(50); // Use default userId
      console.log('🔍 Calling prokipService.getProducts(50)...');
      const products = await prokipService.getProducts(50); // Use default userId
      headers = await prokipService.getAuthHeaders(50); // Use default userId
    } else {
      // Mock mode
      const prokip = await prisma.prokipConfig.findFirst({ where: { userId: 50 } });
      if (!prokip || !prokip.token) return;
      
      headers = { Authorization: `Bearer ${prokip.token}`, Accept: 'application/json' };
      
      const response = await axios.get(PROKIP_BASE + 'product-stock-report', { headers });
      stockData = response.data;
    }
  } catch (error) {
    console.error('Failed to get Prokip stock data:', error.message);
    return;
  }

  if (!stockData || !Array.isArray(stockData)) {
    // Handle case where stockData might be nested in response
    stockData = stockData?.data || [];
  }

  const connections = await prisma.connection.findMany();

  for (const conn of connections) {
    if (!conn.syncEnabled) continue; // Skip if sync disabled
    const inventoryLogs = await prisma.inventoryLog.findMany({ where: { connectionId: conn.id } });

    for (const item of stockData) {
      const log = inventoryLogs.find(c => c.sku === item.sku);
      const currentQty = parseInt(item.stock || item.qty_available || 0);
      const productName = item.product_name || item.name || 'Unknown Product';
      const productId = item.product_id || item.id?.toString() || item.sku;
      const price = parseFloat(item.price || item.sell_price_inc_tax || 0);

      try {
        if (log && log.quantity !== currentQty) {
          await updateInventoryInStore(conn, item.sku, currentQty);
          await prisma.inventoryLog.update({
            where: { id: log.id },
            data: { 
              quantity: currentQty,
              price: price,
              lastSynced: new Date()
            }
          });
        } else if (!log) {
          await prisma.inventoryLog.create({
            data: { 
              connectionId: conn.id, 
              sku: item.sku, 
              quantity: currentQty,
              productId: productId,
              productName: productName,
              price: price
            }
          });
        }
      } catch (error) {
        console.error(`Failed to sync inventory for SKU ${item.sku}:`, error.message);
      }
    }
  }
}

module.exports = { processStoreToProkip, pollProkipToStores, getProkipHeaders };
