const prisma = require('../lib/prisma');

/**
 * Get comprehensive analytics dashboard data
 * Uses actual schema models: SalesLog, InventoryLog, Connection
 * @param {number} userId - User ID for filtering data
 * @param {string} dateRange - Date range filter (7d, 30d, 90d)
 * @returns {Promise<Object>} - Analytics data
 */
async function getDashboardAnalytics(userId = null, dateRange = '30d') {
  try {
    // Calculate date filter
    const days = parseInt(dateRange.replace('d', '')) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get user's connections
    const connections = await prisma.connection.findMany({
      where: userId ? { userId: parseInt(userId) } : {}
    });
    
    const connectionIds = connections.map(c => c.id);

    // Get sales data from SalesLog
    const salesLogs = await prisma.salesLog.findMany({
      where: {
        connectionId: { in: connectionIds.length > 0 ? connectionIds : [-1] },
        orderDate: { gte: startDate }
      },
      include: {
        connection: true
      },
      orderBy: { orderDate: 'desc' }
    });

    // Get inventory data from InventoryLog
    const inventoryLogs = await prisma.inventoryLog.findMany({
      where: {
        connectionId: { in: connectionIds.length > 0 ? connectionIds : [-1] }
      }
    });

    // Calculate metrics
    const analytics = {
      overview: {
        totalRevenue: salesLogs.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0),
        totalOrders: salesLogs.length,
        averageOrderValue: salesLogs.length > 0 
          ? salesLogs.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0) / salesLogs.length 
          : 0,
        totalProducts: inventoryLogs.length,
        connectedStores: connections.length,
        lowStockItems: inventoryLogs.filter(inv => inv.quantity < 10).length
      },
      
      salesByPlatform: calculateSalesByPlatform(salesLogs),
      
      revenueChart: calculateRevenueChart(salesLogs, days),
      
      topProducts: calculateTopProductsSync(inventoryLogs),
      
      recentActivity: calculateRecentActivity(salesLogs, connections),
      
      inventoryStatus: calculateInventoryStatus(inventoryLogs),
      
      syncStatus: calculateSyncStatus(connections)
    };

    return analytics;
    
  } catch (error) {
    console.error('Failed to get dashboard analytics:', error);
    throw new Error('Could not load analytics data: ' + error.message);
  }
}

/**
 * Calculate sales breakdown by platform
 */
function calculateSalesByPlatform(salesLogs) {
  const platformData = {};
  
  salesLogs.forEach(sale => {
    const platform = sale.platform || sale.connection?.platform || 'unknown';
    
    if (!platformData[platform]) {
      platformData[platform] = {
        orders: 0,
        revenue: 0,
        percentage: 0
      };
    }
    platformData[platform].orders++;
    platformData[platform].revenue += (sale.totalAmount || 0);
  });

  const totalRevenue = Object.values(platformData).reduce((sum, platform) => sum + platform.revenue, 0);
  
  Object.keys(platformData).forEach(platform => {
    platformData[platform].percentage = totalRevenue > 0 
      ? Math.round((platformData[platform].revenue / totalRevenue) * 100 * 10) / 10 
      : 0;
  });

  return platformData;
}

/**
 * Calculate revenue chart data
 */
function calculateRevenueChart(salesLogs, days) {
  const chartData = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const daySales = salesLogs.filter(sale => 
      sale.orderDate && sale.orderDate.toISOString().split('T')[0] === dateStr
    );
    
    chartData.push({
      date: dateStr,
      revenue: daySales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0),
      orders: daySales.length
    });
  }
  
  return chartData;
}

/**
 * Calculate top products from inventory logs (synchronous version)
 */
function calculateTopProductsSync(inventoryLogs) {
  return inventoryLogs
    .sort((a, b) => b.price - a.price) // Sort by price/value
    .slice(0, 10)
    .map(inv => ({
      name: inv.productName,
      sku: inv.sku,
      currentStock: inv.quantity,
      price: inv.price,
      lastSynced: inv.lastSynced
    }));
}

/**
 * Calculate recent activity
 */
function calculateRecentActivity(salesLogs, connections) {
  const activities = [];
  
  // Add recent sales
  salesLogs.slice(0, 5).forEach(sale => {
    const platform = sale.platform || sale.connection?.platform || 'store';
    activities.push({
      type: 'sale',
      message: `New order ${sale.invoiceNo || sale.orderId} from ${platform}`,
      timestamp: sale.orderDate || sale.syncedAt,
      amount: sale.totalAmount,
      status: sale.status || 'completed'
    });
  });
  
  // Add recent store syncs
  connections.forEach(conn => {
    if (conn.lastSync) {
      activities.push({
        type: 'sync',
        message: `Inventory synced with ${conn.storeName || conn.storeUrl}`,
        timestamp: conn.lastSync,
        status: conn.syncEnabled ? 'success' : 'paused'
      });
    }
  });
  return activities
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10);
}

/**
 * Calculate inventory status
 */
function calculateInventoryStatus(inventoryLogs) {
  const status = {
    total: inventoryLogs.length,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0
  };
  
  inventoryLogs.forEach(inv => {
    const quantity = inv.quantity || 0;
    
    if (quantity === 0) {
      status.outOfStock++;
    } else if (quantity < 10) {
      status.lowStock++;
    } else {
      status.inStock++;
    }
  });
  
  return status;
}

/**
 * Calculate sync status for connected stores
 */
function calculateSyncStatus(connections) {
  const lastSyncTimes = connections
    .filter(c => c.lastSync)
    .map(c => new Date(c.lastSync).getTime());
    
  const status = {
    total: connections.length,
    connected: connections.filter(c => c.syncEnabled !== false).length,
    paused: connections.filter(c => c.syncEnabled === false).length,
    error: 0,
    lastSync: lastSyncTimes.length > 0 ? new Date(Math.max(...lastSyncTimes)) : null
  };
  
  return status;
}

/**
 * Get product performance analytics
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Product performance data
 */
async function getProductPerformance(userId = null) {
  try {
    // Get user's connections
    const connections = await prisma.connection.findMany({
      where: userId ? { userId: parseInt(userId) } : {}
    });
    
    const connectionIds = connections.map(c => c.id);

    // Get inventory logs
    const inventoryLogs = await prisma.inventoryLog.findMany({
      where: {
        connectionId: { in: connectionIds.length > 0 ? connectionIds : [-1] }
      },
      orderBy: { lastSynced: 'desc' }
    });

    // Calculate performance metrics for each inventory item
    const performance = inventoryLogs.map(inv => {
      const currentStock = inv.quantity || 0;
      
      return {
        id: inv.id,
        sku: inv.sku,
        name: inv.productName,
        currentStock,
        price: inv.price,
        totalValue: currentStock * (inv.price || 0),
        lastSynced: inv.lastSynced,
        stockStatus: currentStock === 0 ? 'out_of_stock' : currentStock < 10 ? 'low_stock' : 'in_stock'
      };
    });

    return {
      products: performance.sort((a, b) => b.totalValue - a.totalValue),
      summary: {
        totalProducts: inventoryLogs.length,
        totalValue: performance.reduce((sum, p) => sum + p.totalValue, 0),
        lowStockProducts: performance.filter(p => p.stockStatus === 'low_stock').length,
        outOfStockProducts: performance.filter(p => p.stockStatus === 'out_of_stock').length
      }
    };
    
  } catch (error) {
    console.error('Failed to get product performance:', error);
    throw new Error('Could not load product performance data: ' + error.message);
  }
}

module.exports = {
  getDashboardAnalytics,
  getProductPerformance
};
