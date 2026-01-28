const prisma = require('../lib/prisma');

/**
 * Record a sale in Prokip with platform prefix
 * @param {Object} saleData - Sale details with platform info
 * @returns {Promise<Object>} - Sale response
 */
async function recordSaleWithPrefix(saleData) {
  try {
    const { platform, products, total, locationId, customerId } = saleData;
    
    // Generate invoice number with platform prefix
    const prefixMap = {
      'woocommerce': 'WOO',
      'shopify': 'SHOPIFY', 
      'prokip': 'PROKIP'
    };
    
    const prefix = prefixMap[platform.toLowerCase()] || 'UNKNOWN';
    const invoiceNo = `${prefix}-${Date.now()}`;
    
    // Create sale record in Prokip
    const sellBody = {
      sells: [{
        location_id: parseInt(locationId || 1),
        contact_id: customerId || 1,
        transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        invoice_no: invoiceNo,
        status: 'final',
        type: 'sell',
        payment_status: 'paid',
        final_total: parseFloat(total),
        discount_amount: parseFloat(saleData.discount || 0),
        discount_type: 'fixed',
        products: products.map(product => ({
          product_id: product.id,
          quantity: parseFloat(product.quantity),
          unit_price: parseFloat(product.price)
        })),
        payments: [{
          method: saleData.paymentMethod || 'cash',
          amount: parseFloat(total),
          paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
        }],
        // Add platform metadata
        platform_source: platform,
        platform_order_id: saleData.platformOrderId,
        sync_status: 'synced'
      }]
    };

    // Store in local database for tracking
    await prisma.sale.create({
      data: {
        invoiceNo,
        platform,
        platformOrderId: saleData.platformOrderId,
        total: parseFloat(total),
        status: 'completed',
        locationId: parseInt(locationId || 1),
        customerId: customerId || 1,
        products: {
          create: products.map(product => ({
            productId: product.id,
            sku: product.sku,
            name: product.name,
            quantity: parseFloat(product.quantity),
            price: parseFloat(product.price)
          }))
        }
      }
    });

    console.log(`✅ Sale recorded with prefix: ${invoiceNo}`);
    
    return {
      success: true,
      invoice_no: invoiceNo,
      platform,
      total,
      message: `Sale recorded successfully from ${platform}`
    };
    
  } catch (error) {
    console.error('Failed to record sale:', error);
    throw new Error(`Could not record sale: ${error.message}`);
  }
}

/**
 * Get sales analytics by platform
 * @param {number} locationId - Business location ID
 * @returns {Promise<Object>} - Analytics data
 */
async function getSalesAnalytics(locationId = null) {
  try {
    const whereClause = locationId ? { locationId: parseInt(locationId) } : {};
    
    const sales = await prisma.sale.findMany({
      where: whereClause,
      include: {
        products: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate analytics
    const analytics = {
      total_sales: sales.reduce((sum, sale) => sum + sale.total, 0),
      total_orders: sales.length,
      sales_by_platform: {},
      recent_sales: sales.slice(0, 10).map(sale => ({
        invoice_no: sale.invoiceNo,
        platform: sale.platform,
        total: sale.total,
        date: sale.createdAt,
        status: sale.status
      })),
      top_selling_products: {}
    };

    // Group by platform
    sales.forEach(sale => {
      if (!analytics.sales_by_platform[sale.platform]) {
        analytics.sales_by_platform[sale.platform] = {
          orders: 0,
          revenue: 0
        };
      }
      analytics.sales_by_platform[sale.platform].orders++;
      analytics.sales_by_platform[sale.platform].revenue += sale.total;
    });

    // Group by products
    sales.forEach(sale => {
      sale.products.forEach(product => {
        if (!analytics.top_selling_products[product.sku]) {
          analytics.top_selling_products[product.sku] = {
            name: product.name,
            sku: product.sku,
            quantity_sold: 0,
            revenue: 0
          };
        }
        analytics.top_selling_products[product.sku].quantity_sold += product.quantity;
        analytics.top_selling_products[product.sku].revenue += (product.quantity * product.price);
      });
    });

    // Sort products by revenue
    analytics.top_selling_products = Object.values(analytics.top_selling_products)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return analytics;
    
  } catch (error) {
    console.error('Failed to get sales analytics:', error);
    throw new Error('Could not load sales analytics');
  }
}

/**
 * Sync inventory from Prokip to connected stores
 * @param {number} locationId - Business location ID
 * @returns {Promise<Object>} - Sync result
 */
async function syncInventoryToStores(locationId = null) {
  try {
    // Get connected stores
    const stores = await prisma.store.findMany({
      where: { 
        status: 'connected',
        ...(locationId && { locationId: parseInt(locationId) })
      }
    });

    const syncResults = [];

    for (const store of stores) {
      try {
        // Get Prokip products
        const prokipProducts = await getProkipProducts(locationId);
        
        // Update inventory in store
        const result = await updateStoreInventory(store, prokipProducts);
        
        syncResults.push({
          storeName: store.name,
          platform: store.platform,
          status: 'success',
          productsUpdated: result.updated,
          message: `Successfully synced ${result.updated} products`
        });
        
      } catch (error) {
        syncResults.push({
          storeName: store.name,
          platform: store.platform,
          status: 'error',
          message: error.message
        });
      }
    }

    return {
      success: true,
      syncResults,
      totalStores: stores.length,
      successfulSyncs: syncResults.filter(r => r.status === 'success').length
    };
    
  } catch (error) {
    console.error('Failed to sync inventory:', error);
    throw new Error('Could not sync inventory to stores');
  }
}

module.exports = {
  recordSaleWithPrefix,
  getSalesAnalytics,
  syncInventoryToStores
};
