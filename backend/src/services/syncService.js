const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { updateInventoryInStore } = require('./storeService');
const { mapOrderToProkipSell, mapRefundToProkipProducts, mapCancellationProducts } = require('./prokipMapper');

const prisma = new PrismaClient();
const MOCK_PROKIP = process.env.MOCK_PROKIP === 'true';
const PROKIP_BASE = MOCK_PROKIP 
  ? (process.env.MOCK_PROKIP_URL || 'http://localhost:4000') + '/connector/api/'
  : process.env.PROKIP_API + '/connector/api/';

/**
 * Log sync errors to database for tracking and resolution
 */
async function logSyncError(connectionId, orderId, errorType, errorMessage, errorData = null) {
  try {
    await prisma.syncError.create({
      data: {
        connectionId,
        orderId: orderId?.toString(),
        errorType,
        errorMessage,
        errorData: errorData ? JSON.parse(JSON.stringify(errorData)) : null
      }
    });
    console.error(`[SyncError] ${errorType}: ${errorMessage}`, errorData);
  } catch (err) {
    console.error('Failed to log sync error:', err.message);
  }
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
    // Update cache
    const cache = await prisma.inventoryCache.findFirst({
      where: { 
        connectionId: connection.id,
        sku 
      }
    });

    if (cache) {
      const newQuantity = cache.quantity + quantity;
      await prisma.inventoryCache.update({
        where: { id: cache.id },
        data: { quantity: newQuantity }
      });
      
      // Update store inventory
      await updateInventoryInStore(connection, sku, newQuantity);
      console.log(`✓ Restored ${quantity} units of SKU ${sku} (new total: ${newQuantity})`);
    } else {
      console.log(`⚠️ No inventory cache found for SKU ${sku}, skipping store update`);
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
 */
async function processStoreToProkip(storeUrl, topic, data, platform) {
  const prokip = await prisma.prokipConfig.findUnique({ where: { id: 1 } });
  if (!prokip || !prokip.token || !prokip.locationId) {
    console.error('Prokip config not found or incomplete');
    return;
  }

  const connection = await prisma.connection.findFirst({ where: { storeUrl } });
  if (!connection) {
    console.error(`No connection found for store: ${storeUrl}`);
    return;
  }

  const headers = {
    Authorization: `Bearer ${prokip.token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

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
          const cache = await prisma.inventoryCache.findFirst({
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
        await prisma.salesLog.create({
          data: {
            connectionId: connection.id,
            orderId,
            prokipSellId: response.data.id?.toString(),
            timestamp: new Date()
          }
        });
        console.log(`✓ Sale recorded in Prokip for order ${orderId}`);
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
  const prokip = await prisma.prokipConfig.findUnique({ where: { id: 1 } });
  if (!prokip || !prokip.token) return;

  const headers = { Authorization: `Bearer ${prokip.token}`, Accept: 'application/json' };

  try {
    const response = await axios.get(PROKIP_BASE + 'product-stock-report', { headers });
    const stockData = response.data; // array of stock items

    const connections = await prisma.connection.findMany();

    for (const conn of connections) {
      if (!conn.syncEnabled) continue; // Skip if sync disabled
      const caches = await prisma.inventoryCache.findMany({ where: { connectionId: conn.id } });

      for (const item of stockData) {
        const cache = caches.find(c => c.sku === item.sku);
        const currentQty = parseInt(item.stock || item.qty_available || 0);

        if (cache && cache.quantity !== currentQty) {
          await updateInventoryInStore(conn, item.sku, currentQty);
          await prisma.inventoryCache.update({
            where: { id: cache.id },
            data: { quantity: currentQty }
          });
        } else if (!cache) {
          await prisma.inventoryCache.create({
            data: { connectionId: conn.id, sku: item.sku, quantity: currentQty }
          });
        }
      }
    }
  } catch (error) {
    console.error('Polling Prokip stock failed:', error.response?.data || error.message);
  }
}

module.exports = { processStoreToProkip, pollProkipToStores };
