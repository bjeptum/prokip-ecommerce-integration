const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Get comprehensive analytics dashboard data
 * @param {number} locationId - Business location ID
 * @param {string} dateRange - Date range filter (7d, 30d, 90d)
 * @returns {Promise<Object>} - Analytics data
 */
async function getDashboardAnalytics(locationId = null, dateRange = '30d') {
  try {
    // Calculate date filter
    const days = parseInt(dateRange.replace('d', ''));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const whereClause = {
      createdAt: {
        gte: startDate
      },
      ...(locationId && { locationId: parseInt(locationId) })
    };

    // Get sales data
    const sales = await prisma.sale.findMany({
      where: whereClause,
      include: {
        products: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get products data
    const products = await prisma.product.findMany({
      where: locationId ? { locationId: parseInt(locationId) } : {},
      include: {
        inventory: true
      }
    });

    // Get connected stores
    const stores = await prisma.store.findMany({
      where: { 
        status: 'connected',
        ...(locationId && { locationId: parseInt(locationId) })
      }
    });

    // Calculate metrics
    const analytics = {
      overview: {
        totalRevenue: sales.reduce((sum, sale) => sum + sale.total, 0),
        totalOrders: sales.length,
        averageOrderValue: sales.length > 0 ? sales.reduce((sum, sale) => sum + sale.total, 0) / sales.length : 0,
        totalProducts: products.length,
        connectedStores: stores.length,
        lowStockItems: products.filter(p => p.inventory && p.inventory.quantity < 10).length
      },
      
      salesByPlatform: calculateSalesByPlatform(sales),
      
      revenueChart: calculateRevenueChart(sales, days),
      
      topProducts: calculateTopProducts(sales),
      
      recentActivity: calculateRecentActivity(sales, stores),
      
      inventoryStatus: calculateInventoryStatus(products),
      
      syncStatus: calculateSyncStatus(stores)
    };

    return analytics;
    
  } catch (error) {
    console.error('Failed to get dashboard analytics:', error);
    throw new Error('Could not load analytics data');
  }
}

/**
 * Calculate sales breakdown by platform
 */
function calculateSalesByPlatform(sales) {
  const platformData = {};
  
  sales.forEach(sale => {
    if (!platformData[sale.platform]) {
      platformData[sale.platform] = {
        orders: 0,
        revenue: 0,
        percentage: 0
      };
    }
    platformData[sale.platform].orders++;
    platformData[sale.platform].revenue += sale.total;
  });

  const totalRevenue = Object.values(platformData).reduce((sum, platform) => sum + platform.revenue, 0);
  
  Object.keys(platformData).forEach(platform => {
    platformData[platform].percentage = totalRevenue > 0 ? (platformData[platform].revenue / totalRevenue) * 100 : 0;
  });

  return platformData;
}

/**
 * Calculate revenue chart data
 */
function calculateRevenueChart(sales, days) {
  const chartData = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const daySales = sales.filter(sale => 
      sale.createdAt.toISOString().split('T')[0] === dateStr
    );
    
    chartData.push({
      date: dateStr,
      revenue: daySales.reduce((sum, sale) => sum + sale.total, 0),
      orders: daySales.length
    });
  }
  
  return chartData;
}

/**
 * Calculate top selling products
 */
function calculateTopProducts(sales) {
  const productSales = {};
  
  sales.forEach(sale => {
    sale.products.forEach(product => {
      if (!productSales[product.sku]) {
        productSales[product.sku] = {
          name: product.name,
          sku: product.sku,
          quantitySold: 0,
          revenue: 0
        };
      }
      productSales[product.sku].quantitySold += product.quantity;
      productSales[product.sku].revenue += (product.quantity * product.price);
    });
  });
  
  return Object.values(productSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

/**
 * Calculate recent activity
 */
function calculateRecentActivity(sales, stores) {
  const activities = [];
  
  // Add recent sales
  sales.slice(0, 5).forEach(sale => {
    activities.push({
      type: 'sale',
      message: `New order ${sale.invoiceNo} from ${sale.platform}`,
      timestamp: sale.createdAt,
      amount: sale.total,
      status: 'completed'
    });
  });
  
  // Add recent store syncs
  stores.forEach(store => {
    if (store.lastSyncAt) {
      activities.push({
        type: 'sync',
        message: `Inventory synced with ${store.name}`,
        timestamp: store.lastSyncAt,
        status: 'success'
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
function calculateInventoryStatus(products) {
  const status = {
    total: products.length,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0
  };
  
  products.forEach(product => {
    const quantity = product.inventory ? product.inventory.quantity : 0;
    
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
function calculateSyncStatus(stores) {
  const status = {
    total: stores.length,
    connected: stores.filter(s => s.status === 'connected').length,
    syncing: stores.filter(s => s.status === 'syncing').length,
    error: stores.filter(s => s.status === 'error').length,
    lastSync: stores.length > 0 ? Math.max(...stores.map(s => s.lastSyncAt ? new Date(s.lastSyncAt).getTime() : 0)) : null
  };
  
  return status;
}

/**
 * Get product performance analytics
 * @param {number} locationId - Business location ID
 * @returns {Promise<Object>} - Product performance data
 */
async function getProductPerformance(locationId = null) {
  try {
    const sales = await prisma.sale.findMany({
      where: locationId ? { locationId: parseInt(locationId) } : {},
      include: {
        products: true
      }
    });

    const products = await prisma.product.findMany({
      where: locationId ? { locationId: parseInt(locationId) } : {},
      include: {
        inventory: true
      }
    });

    // Calculate performance metrics for each product
    const performance = products.map(product => {
      const productSales = sales
        .filter(sale => sale.products.some(p => p.productId === product.id))
        .flatMap(sale => sale.products.filter(p => p.productId === product.id));

      const totalSold = productSales.reduce((sum, sale) => sum + sale.quantity, 0);
      const totalRevenue = productSales.reduce((sum, sale) => sum + (sale.quantity * sale.price), 0);
      const currentStock = product.inventory ? product.inventory.quantity : 0;

      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        totalSold,
        totalRevenue,
        currentStock,
        averagePrice: totalSold > 0 ? totalRevenue / totalSold : 0,
        lastSold: productSales.length > 0 ? Math.max(...productSales.map(s => new Date(s.createdAt).getTime())) : null,
        trend: calculateTrend(productSales),
        stockStatus: currentStock === 0 ? 'out_of_stock' : currentStock < 10 ? 'low_stock' : 'in_stock'
      };
    });

    return {
      products: performance.sort((a, b) => b.totalRevenue - a.totalRevenue),
      summary: {
        totalProducts: products.length,
        productsWithSales: performance.filter(p => p.totalSold > 0).length,
        lowStockProducts: performance.filter(p => p.stockStatus === 'low_stock').length,
        outOfStockProducts: performance.filter(p => p.stockStatus === 'out_of_stock').length
      }
    };
    
  } catch (error) {
    console.error('Failed to get product performance:', error);
    throw new Error('Could not load product performance data');
  }
}

/**
 * Calculate sales trend for a product
 */
function calculateTrend(sales) {
  if (sales.length < 2) return 'stable';
  
  const recentSales = sales.slice(-5); // Last 5 sales
  const olderSales = sales.slice(-10, -5); // Previous 5 sales
  
  if (olderSales.length === 0) return 'increasing';
  
  const recentAvg = recentSales.reduce((sum, sale) => sum + sale.quantity, 0) / recentSales.length;
  const olderAvg = olderSales.reduce((sum, sale) => sum + sale.quantity, 0) / olderSales.length;
  
  if (recentAvg > olderAvg * 1.2) return 'increasing';
  if (recentAvg < olderAvg * 0.8) return 'decreasing';
  return 'stable';
}

module.exports = {
  getDashboardAnalytics,
  getProductPerformance
};
