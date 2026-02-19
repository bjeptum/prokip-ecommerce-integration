const express = require('express');
const authenticateToken = require('../middlewares/authMiddleware');
const { pollProkipToStores } = require('../services/syncService');
const { performBidirectionalSync } = require('../services/bidirectionalSyncService');
const prokipEcomClient = require('../services/prokipEcomClient');
const prisma = require('../lib/prisma');
const errorRecoveryService = require('../services/errorRecoveryService');

const router = express.Router();

// Custom authentication middleware for sync routes
router.use(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  // Try to verify as JWT first
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.user = decoded;
    return next();
  } catch (jwtError) {
    // If JWT fails, try Prokip token
    try {
      const prokipConfig = await prisma.prokipConfig.findFirst({ where: { token } });
      
      if (prokipConfig) {
        req.userId = prokipConfig.userId;
        req.user = { id: prokipConfig.userId };
        return next();
      } else {
        // Last chance: allow globally configured PROKIP_ECOM_TOKEN for system triggers
        if (process.env.PROKIP_ECOM_TOKEN && token === process.env.PROKIP_ECOM_TOKEN) {
          req.userId = prokipConfig?.userId || null;
          return next();
        }
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
    } catch (dbError) {
      return res.status(403).json({ error: 'Invalid token' });
    }
  }
});

router.post('/', async (req, res) => {
  await pollProkipToStores();
  res.json({ success: true, message: 'Manual sync triggered (no-op in /api/ecom mode)' });
});

/**
 * BIDIRECTIONAL SYNC ENDPOINT
 * Uses Prokip-2 /api/ecom pipeline (store → Prokip only)
 */
router.post('/bidirectional', authenticateToken, async (req, res) => {
  try {
    const { connectionId, direction = 'both' } = req.body;
    const userId = req.userId;

    if (!connectionId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Connection ID is required' 
      });
    }

    console.log(`🔄 Starting bidirectional sync for connection ${connectionId}, direction: ${direction}`);

    const result = await performBidirectionalSync(connectionId, userId, direction);
    
    res.json({
      success: true,
      message: 'Bidirectional sync completed',
      result: result
    });

  } catch (error) {
    console.error('Bidirectional sync error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Bidirectional sync failed',
      error: error.message 
    });
  }
});

// Status endpoint doesn't require auth (public dashboard data)
router.get('/status', async (req, res) => {
  const connections = await prisma.connection.findMany();

  let prokipStats = { products: 0, sales: 0, purchases: 0 };

  try {
    const prokipProducts = await prisma.inventoryLog.groupBy({
      by: ['sku'],
      _count: { sku: true }
    });
    prokipStats.products = prokipProducts.length;

    const salesCount = await prisma.salesLog.count({
      where: { 
        status: {
          in: ['completed', 'paid', 'processing']
        }
      }
    });

    prokipStats.sales = salesCount;
    prokipStats.purchases = 0;
  } catch (error) {
    console.error('Error fetching Prokip stats:', error);
  }

  const connectionsWithStats = await Promise.all(connections.map(async (c) => {
    let productCount = 0;
    let orderCount = 0;

    try {
      productCount = await prisma.inventoryLog.count({
        where: { connectionId: c.id }
      });
    } catch (error) {
      productCount = 0;
    }

    try {
      orderCount = await prisma.salesLog.count({
        where: {
          connectionId: c.id,
          status: {
            in: ['completed', 'paid', 'processing']
          }
        }
      });
    } catch (error) {
      orderCount = 0;
    }

    return {
      id: c.id,
      platform: c.platform,
      storeUrl: c.storeUrl,
      storeName: c.storeName,
      lastSync: c.lastSync,
      syncEnabled: c.syncEnabled || true,
      productCount,
      orderCount
    };
  }));

  res.json({
    stores: connectionsWithStats,
    prokip: prokipStats
  });
});

router.post('/pause', async (req, res) => {
  const { connectionId } = req.body;
  if (connectionId) {
    await prisma.connection.update({
      where: { id: parseInt(connectionId) },
      data: { syncEnabled: false }
    });
  } else {
    await prisma.connection.updateMany({ data: { syncEnabled: false } });
  }
  res.json({ success: true, message: 'Sync paused' });
});

router.post('/resume', async (req, res) => {
  const { connectionId } = req.body;
  if (connectionId) {
    await prisma.connection.update({
      where: { id: parseInt(connectionId) },
      data: { syncEnabled: true }
    });
  } else {
    await prisma.connection.updateMany({ data: { syncEnabled: true } });
  }
  res.json({ success: true, message: 'Sync resumed' });
});

router.post('/pull-orders', authenticateToken, async (req, res) => {
  const userId = req.userId;
  const connections = await prisma.connection.findMany({ 
    where: { 
      platform: 'woocommerce',
      userId: userId
    } 
  });
  
  for (const conn of connections) {
    try {
      console.log(`🔄 Triggering Prokip-2 sync for store ${conn.storeUrl}...`);
      await prokipEcomClient.syncOrders({
        store_id: conn.id,
        status: 'processing',
        limit: 100,
        page: 1
      }, userId);
    } catch (error) {
      console.error(`Failed to trigger Prokip-2 sync for ${conn.storeUrl}:`, error.message);
    }
  }
  
  res.json({ success: true, message: 'Orders sync triggered via Prokip-2' });
});

// Get sync errors for monitoring
router.get('/errors', async (req, res) => {
  try {
    const { connectionId, resolved } = req.query;
    
    const where = {};
    if (connectionId) where.connectionId = parseInt(connectionId);
    if (resolved !== undefined) where.resolved = resolved === 'true';
    
    const errors = await prisma.syncError.findMany({
      where,
      include: {
        connection: {
          select: {
            platform: true,
            storeUrl: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    
    res.json(errors);
  } catch (error) {
    console.error('Failed to fetch sync errors:', error);
    res.status(500).json({ error: 'Failed to fetch sync errors' });
  }
});

// Mark sync error as resolved
router.patch('/errors/:id/resolve', async (req, res) => {
  try {
    const errorId = parseInt(req.params.id);
    await prisma.syncError.update({
      where: { id: errorId },
      data: { resolved: true }
    });
    res.json({ success: true, message: 'Error marked as resolved' });
  } catch (error) {
    console.error('Failed to resolve sync error:', error);
    res.status(500).json({ error: 'Failed to resolve sync error' });
  }
});

// Automatic error recovery
router.post('/recover', async (req, res) => {
  try {
    const { errorId } = req.body;
    
    const result = await errorRecoveryService.processErrorRecovery(errorId);
    
    res.json({
      success: true,
      message: 'Error recovery process completed',
      ...result
    });
  } catch (error) {
    console.error('Error recovery failed:', error);
    res.status(500).json({
      error: 'Error recovery failed',
      details: error.message
    });
  }
});

// Get error recovery statistics
router.get('/recovery-stats', async (req, res) => {
  try {
    const { connectionId } = req.query;
    const stats = await errorRecoveryService.getRecoveryStats(connectionId);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Failed to get recovery stats:', error);
    res.status(500).json({
      error: 'Failed to get recovery statistics',
      details: error.message
    });
  }
});

// Schedule automatic error recovery (runs every 5 minutes)
router.post('/schedule-recovery', async (req, res) => {
  try {
    setTimeout(async () => {
      try {
        console.log('🔄 Starting scheduled error recovery...');
        const result = await errorRecoveryService.processErrorRecovery();
        console.log(`✅ Scheduled recovery completed: ${result.processed} errors processed`);
      } catch (error) {
        console.error('❌ Scheduled error recovery failed:', error);
      }
    }, 1000);
    
    res.json({
      success: true,
      message: 'Error recovery scheduled to run in background'
    });
  } catch (error) {
    console.error('Failed to schedule error recovery:', error);
    res.status(500).json({
      error: 'Failed to schedule error recovery',
      details: error.message
    });
  }
});

module.exports = router;
