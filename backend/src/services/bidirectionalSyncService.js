/**
 * BIDIRECTIONAL SYNC SERVICE
 * 
 * Handles proper bidirectional synchronization between Prokip and E-commerce stores
 * according to Prokip API documentation standards
 */

const prisma = require('../lib/prisma');
const prokipEcomClient = require('./prokipEcomClient');

/**
 * DIRECTION 1: E-commerce Store → Prokip
 * When sales are made in WooCommerce/Shopify, sync to Prokip and deduct stock
 */
async function syncStoreSalesToProkip(connectionId, userId) {
  try {
    console.log(`🔄 Syncing sales from store to Prokip (Connection: ${connectionId})`);
    
    // Get store connection
    const connection = await prisma.connection.findFirst({
      where: { 
        id: parseInt(connectionId),
        userId: userId
      }
    });

    if (!connection) {
      throw new Error('Store connection not found');
    }

    const response = await prokipEcomClient.syncOrders({
      store_id: connection.id,
      status: 'completed',
      limit: 100,
      page: 1
    }, userId);

    // Update connection last sync time
    await prisma.connection.update({
      where: { id: connection.id },
      data: { lastSync: new Date() }
    });

    return response;

  } catch (error) {
    console.error('Store to Prokip sync error:', error);
    throw error;
  }
}

/**
 * DIRECTION 2: Prokip → E-commerce Store
 * When sales are made in Prokip, sync stock levels to WooCommerce/Shopify
 */
async function syncProkipInventoryToStore(connectionId, userId) {
  throw new Error('Prokip → store sync is disabled in /api/ecom pipeline.');
}

/**
 * Complete bidirectional sync
 * Handles both directions in sequence
 */
async function performBidirectionalSync(connectionId, userId, direction = 'both') {
  try {
    console.log(`🔄 Starting bidirectional sync (Connection: ${connectionId}, Direction: ${direction})`);
    
    const results = {
      store_to_prokip: null,
      prokip_to_store: null
    };

    // Direction 1: Store → Prokip (sync sales)
    if (direction === 'both' || direction === 'store-to-prokip') {
      try {
        results.store_to_prokip = await syncStoreSalesToProkip(connectionId, userId);
      } catch (error) {
        results.store_to_prokip = {
          success: false,
          error: error.message
        };
      }
    }

    // Direction 2: Prokip → Store (sync inventory)
    if (direction === 'both' || direction === 'prokip-to-store') {
      try {
        results.prokip_to_store = await syncProkipInventoryToStore(connectionId, userId);
      } catch (error) {
        results.prokip_to_store = {
          success: false,
          error: error.message
        };
      }
    }

    return {
      success: true,
      connection_id: connectionId,
      direction: direction,
      results: results,
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
