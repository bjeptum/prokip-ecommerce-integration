/**
 * BIDIRECTIONAL SYNC SERVICE
 *
 * Handles proper bidirectional synchronization between Prokip and E-commerce stores.
 */

const prisma = require('../lib/prisma');
const prokipEcomClient = require('./prokipEcomClient');
const prokipLocalAuthService = require('./prokipLocalAuthService');
const { updateInventoryInStore } = require('./storeService');

/**
 * DIRECTION 1: E-commerce Store → Prokip
 * When sales are made in WooCommerce/Shopify, sync to Prokip and deduct stock
 */
async function syncStoreSalesToProkip(connectionId, userId) {
  try {
    console.log(`SYNC store→prokip (connection ${connectionId})`);

    const connection = await prisma.connection.findFirst({
      where: {
        id: parseInt(connectionId, 10),
        userId
      }
    });

    if (!connection) {
      throw new Error('Store connection not found');
    }

    const response = await prokipEcomClient.syncOrders(
      {
        store_id: connection.id,
        status: 'completed',
        limit: 100,
        page: 1
      },
      userId
    );

    await prisma.connection.update({
      where: { id: connection.id },
      data: { lastSync: new Date() }
    });

    return response;
  } catch (error) {
    console.error('Store -> Prokip sync error:', error);
    throw error;
  }
}

/**
 * DIRECTION 2: Prokip → E-commerce Store
 * When sales or purchases are made in Prokip, mirror stock levels to WooCommerce/Shopify
 */
async function syncProkipInventoryToStore(connectionId, userId) {
  const connection = await prisma.connection.findFirst({
    where: {
      id: parseInt(connectionId, 10),
      ...(userId ? { userId } : {})
    }
  });

  if (!connection) {
    throw new Error('Store connection not found');
  }

  const prokipConfig = await prisma.prokipConfig.findFirst({
    where: { userId: connection.userId || userId }
  });

  const locationId = prokipConfig?.locationId ? parseInt(prokipConfig.locationId, 10) : null;
  if (!locationId) {
    throw new Error('Please select a Prokip business location before syncing inventory');
  }

  const prokipProducts = await prokipLocalAuthService.getProducts(locationId);
  const stockItems = (prokipProducts || []).filter(
    (p) => p?.sku && p.qty_available !== null && p.qty_available !== undefined
  );

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  for (const item of stockItems) {
    const qty = Number.parseFloat(item.qty_available);
    if (!Number.isFinite(qty)) {
      skipped += 1;
      continue;
    }

    try {
      await updateInventoryInStore(connection, item.sku, Math.max(0, Math.floor(qty)));
      updated += 1;
    } catch (err) {
      failed += 1;
      if (errors.length < 10) {
        errors.push({ sku: item.sku, error: err.message });
      }
    }
  }

  await prisma.connection.update({
    where: { id: connection.id },
    data: { lastSync: new Date() }
  });

  return {
    success: failed === 0,
    products_attempted: stockItems.length,
    products_updated: updated,
    products_failed: failed,
    products_skipped: skipped,
    errors
  };
}

/**
 * Complete bidirectional sync
 * Handles both directions in sequence
 */
async function performBidirectionalSync(connectionId, userId, direction = 'both') {
  try {
    console.log(`Bidirectional sync start (connection ${connectionId}, direction: ${direction})`);

    const results = {
      store_to_prokip: null,
      prokip_to_store: null
    };

    if (direction === 'both' || direction === 'store-to-prokip') {
      try {
        results.store_to_prokip = await syncStoreSalesToProkip(connectionId, userId);
      } catch (error) {
        results.store_to_prokip = { success: false, error: error.message };
      }
    }

    if (direction === 'both' || direction === 'prokip-to-store') {
      try {
        results.prokip_to_store = await syncProkipInventoryToStore(connectionId, userId);
      } catch (error) {
        results.prokip_to_store = { success: false, error: error.message };
      }
    }

    return {
      success: true,
      connection_id: connectionId,
      direction,
      results,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Bidirectional sync error:', error);
    throw error;
  }
}

module.exports = {
  syncStoreSalesToProkip,
  syncProkipInventoryToStore,
  performBidirectionalSync
};
