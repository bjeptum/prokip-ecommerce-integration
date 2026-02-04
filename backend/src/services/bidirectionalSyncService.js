/**
 * BIDIRECTIONAL SYNC SERVICE
 * 
 * Handles proper bidirectional synchronization between Prokip and E-commerce stores
 * according to Prokip API documentation standards
 */

const axios = require('axios');
const prisma = require('../lib/prisma');
const { getWooOrders, getWooProducts, updateWooProductStock } = require('./wooService');
const { getShopifyOrders, getShopifyProducts, updateShopifyProductStock } = require('./shopifyService');
const { decryptCredentials } = require('./storeService');
const { deductStockDirectlyFromProkip } = require('./directStockDeduction');

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

    // Get Prokip config
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId }
    });

    if (!prokipConfig?.token || !prokipConfig.locationId) {
      throw new Error('Prokip not configured. Please login to Prokip first.');
    }

    // Get orders from the store
    let orders = [];
    
    if (connection.platform === 'woocommerce') {
      const { consumerKey, consumerSecret } = decryptCredentials(connection);
      orders = await getWooOrders(connection.storeUrl, consumerKey, consumerSecret, 'completed');
    } else if (connection.platform === 'shopify') {
      orders = await getShopifyOrders(connection.storeUrl, connection.accessToken);
    }

    console.log(`📦 Found ${orders.length} orders to process`);

    let syncedCount = 0;
    const results = [];

    for (const order of orders) {
      try {
        // Check if order already processed
        const existingLog = await prisma.salesLog.findFirst({
          where: { 
            connectionId: connection.id,
            orderId: order.id.toString()
          }
        });

        if (existingLog) {
          console.log(`Order ${order.id} already processed, skipping`);
          continue;
        }

        // Get Prokip products for mapping
        const prokipProductsResponse = await axios.get('https://api.prokip.africa/connector/api/product?per_page=-1', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${prokipConfig.token}`,
            Accept: 'application/json'
          }
        });
        const prokipProducts = prokipProductsResponse.data.data;

        // Process order items
        const validItems = order.line_items.filter(item => item.sku);
        if (validItems.length === 0) {
          console.log(`No valid items found for order ${order.id}`);
          continue;
        }

        const sellProducts = validItems.map(item => {
          const prokipProduct = prokipProducts.find(p => p.sku === item.sku);
          if (!prokipProduct) {
            console.log(`Product with SKU ${item.sku} not found in Prokip`);
            return null;
          }

          return {
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            unit_price: parseFloat(item.price || 0),
            total_price: parseFloat(item.total || 0),
            product_id: prokipProduct.id,
            variation_id: prokipProduct.variation_id || prokipProduct.id
          };
        }).filter(item => item !== null);

        if (sellProducts.length === 0) {
          console.log(`No valid Prokip products found for order ${order.id}`);
          continue;
        }

        // Create sale in Prokip
        const finalTotal = parseFloat(order.total || order.total_price || 0);
        const sellBody = {
          sells: [{
            location_id: parseInt(prokipConfig.locationId),
            contact_id: 1849984,
            transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
            invoice_no: `${connection.platform.toUpperCase()}-${order.id}`,
            status: 'final',
            type: 'sell',
            payment_status: 'paid',
            final_total: finalTotal,
            products: sellProducts,
            payments: [{
              method: connection.platform,
              amount: finalTotal,
              paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
            }]
          }]
        };

        // Make API call to Prokip
        const response = await axios.post('https://api.prokip.africa/connector/api/sell', sellBody, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${prokipConfig.token}`,
            Accept: 'application/json'
          }
        });

        if (response.data && !response.data.error) {
          // Create sales log entry
          const salesLog = await prisma.salesLog.create({
            data: {
              connectionId: connection.id,
              orderId: order.id.toString(),
              orderNumber: order.order_number?.toString() || order.id.toString(),
              customerName: order.customer?.first_name || order.billing?.first_name || 'Customer',
              customerEmail: order.customer?.email || order.billing?.email,
              totalAmount: finalTotal,
              status: 'completed',
              orderDate: new Date(order.created_at || order.date_created),
              platform: connection.platform,
              prokipSellId: response.data.id || `PROKIP-${order.id}`
            }
          });

          console.log(`✅ Sale created for order #${order.id} in Prokip`);
          syncedCount++;
          
          results.push({
            order_id: order.id,
            status: 'success',
            total: finalTotal,
            prokip_id: response.data.id
          });
        } else {
          throw new Error('Failed to create sale in Prokip');
        }

      } catch (error) {
        console.error(`Failed to sync order ${order.id}:`, error.message);
        results.push({
          order_id: order.id,
          status: 'failed',
          error: error.message
        });
      }
    }

    // Update connection last sync time
    await prisma.connection.update({
      where: { id: connection.id },
      data: { lastSync: new Date() }
    });

    return {
      success: true,
      orders_synced: syncedCount,
      total_orders: orders.length,
      results
    };

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
  try {
    console.log(`🔄 Syncing inventory from Prokip to store (Connection: ${connectionId})`);
    
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

    // Get Prokip config
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId }
    });

    if (!prokipConfig?.token || !prokipConfig.locationId) {
      throw new Error('Prokip not configured. Please login to Prokip first.');
    }

    // Get products from Prokip
    const prokipProducts = await prokipService.getProducts(prokipConfig.locationId, userId);
    console.log(`📦 Found ${prokipProducts.length} products in Prokip`);

    let updatedCount = 0;
    const results = [];

    for (const product of prokipProducts) {
      try {
        if (!product.sku) continue;

        // Get current inventory log for this product
        const inventoryLog = await prisma.inventoryLog.findFirst({
          where: {
            connectionId: connection.id,
            sku: product.sku
          }
        });

        if (!inventoryLog) {
          console.log(`No inventory log found for SKU ${product.sku}, skipping`);
          continue;
        }

        const currentStock = inventoryLog.quantity;
        const newStock = parseInt(product.stock || product.quantity || 0);

        // Only update if stock has changed
        if (currentStock !== newStock) {
          // Update stock in the store
          if (connection.platform === 'woocommerce') {
            const { consumerKey, consumerSecret } = decryptCredentials(connection);
            await updateWooProductStock(
              connection.storeUrl, 
              consumerKey, 
              consumerSecret, 
              product.sku, 
              newStock
            );
          } else if (connection.platform === 'shopify') {
            await updateShopifyProductStock(
              connection.storeUrl,
              connection.accessToken,
              product.sku,
              newStock
            );
          }

          // Update inventory log
          await prisma.inventoryLog.update({
            where: { id: inventoryLog.id },
            data: {
              quantity: newStock,
              lastSynced: new Date()
            }
          });

          console.log(`✅ Updated stock for SKU ${product.sku}: ${currentStock} → ${newStock}`);
          updatedCount++;
          
          results.push({
            sku: product.sku,
            old_stock: currentStock,
            new_stock: newStock,
            status: 'success'
          });
        } else {
          results.push({
            sku: product.sku,
            stock: newStock,
            status: 'unchanged'
          });
        }

      } catch (error) {
        console.error(`Failed to update product ${product.sku}:`, error.message);
        results.push({
          sku: product.sku,
          status: 'failed',
          error: error.message
        });
      }
    }

    // Update connection last sync time
    await prisma.connection.update({
      where: { id: connection.id },
      data: { lastSync: new Date() }
    });

    return {
      success: true,
      products_updated: updatedCount,
      total_products: prokipProducts.length,
      results
    };

  } catch (error) {
    console.error('Prokip to store sync error:', error);
    throw error;
  }
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
