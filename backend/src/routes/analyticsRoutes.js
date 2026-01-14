const express = require('express');
const { recordSaleWithPrefix, getSalesAnalytics, syncInventoryToStores } = require('../services/salesSyncService');
const { getDashboardAnalytics, getProductPerformance } = require('../services/analyticsService');
const authenticateToken = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * Record a sale with platform prefix
 * POST /api/sales/record
 */
router.post('/record', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const saleData = { ...req.body, userId };
    
    const result = await recordSaleWithPrefix(saleData);
    
    res.json({
      success: true,
      data: result,
      message: 'Sale recorded successfully'
    });
    
  } catch (error) {
    console.error('Failed to record sale:', error);
    res.status(500).json({
      success: false,
      error: 'Could not record sale',
      details: error.message
    });
  }
});

/**
 * Get sales analytics
 * GET /api/sales/analytics
 */
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { locationId, dateRange = '30d' } = req.query;
    
    const analytics = await getSalesAnalytics(locationId, dateRange);
    
    res.json({
      success: true,
      data: analytics
    });
    
  } catch (error) {
    console.error('Failed to get sales analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Could not load sales analytics',
      details: error.message
    });
  }
});

/**
 * Sync inventory to connected stores
 * POST /api/sales/sync-inventory
 */
router.post('/sync-inventory', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { locationId } = req.body;
    
    const result = await syncInventoryToStores(locationId);
    
    res.json({
      success: true,
      data: result,
      message: 'Inventory sync completed'
    });
    
  } catch (error) {
    console.error('Failed to sync inventory:', error);
    res.status(500).json({
      success: false,
      error: 'Could not sync inventory',
      details: error.message
    });
  }
});

/**
 * Get dashboard analytics
 * GET /api/analytics/dashboard
 */
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { dateRange = '30d' } = req.query;
    
    const analytics = await getDashboardAnalytics(userId, dateRange);
    
    res.json({
      success: true,
      data: analytics
    });
    
  } catch (error) {
    console.error('Failed to get dashboard analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Could not load dashboard analytics',
      details: error.message
    });
  }
});

/**
 * Get product performance analytics
 * GET /api/analytics/products
 */
router.get('/products', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    const performance = await getProductPerformance(userId);
    
    res.json({
      success: true,
      data: performance
    });
    
  } catch (error) {
    console.error('Failed to get product performance:', error);
    res.status(500).json({
      success: false,
      error: 'Could not load product performance',
      details: error.message
    });
  }
});

/**
 * Get sync status for all connected stores
 * GET /api/sales/sync-status
 */
router.get('/sync-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    // Get connected stores
    const stores = await prisma.store.findMany({
      where: { 
        userId,
        status: 'connected'
      },
      include: {
        syncLogs: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    const syncStatus = stores.map(store => ({
      id: store.id,
      name: store.name,
      platform: store.platform,
      status: store.status,
      lastSyncAt: store.lastSyncAt,
      lastSyncStatus: store.lastSyncStatus,
      syncLogs: store.syncLogs
    }));

    res.json({
      success: true,
      data: {
        stores: syncStatus,
        totalStores: stores.length,
        activeSyncs: stores.filter(s => s.status === 'syncing').length,
        successfulSyncs: stores.filter(s => s.lastSyncStatus === 'success').length
      }
    });
    
  } catch (error) {
    console.error('Failed to get sync status:', error);
    res.status(500).json({
      success: false,
      error: 'Could not load sync status',
      details: error.message
    });
  }
});

/**
 * Trigger manual sync for a specific store
 * POST /api/sales/sync-store/:storeId
 */
router.post('/sync-store/:storeId', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { storeId } = req.params;
    
    // Update store status to syncing
    await prisma.store.update({
      where: { 
        id: parseInt(storeId),
        userId
      },
      data: {
        status: 'syncing',
        lastSyncAt: new Date()
      }
    });

    // Start sync process (this would be a background job in production)
    // For now, we'll simulate a successful sync
    setTimeout(async () => {
      try {
        await prisma.store.update({
          where: { id: parseInt(storeId) },
          data: {
            status: 'connected',
            lastSyncStatus: 'success'
          }
        });
      } catch (error) {
        console.error('Failed to update store sync status:', error);
      }
    }, 2000);

    res.json({
      success: true,
      message: 'Sync started successfully',
      storeId
    });
    
  } catch (error) {
    console.error('Failed to start sync:', error);
    res.status(500).json({
      success: false,
      error: 'Could not start sync',
      details: error.message
    });
  }
});

module.exports = router;
