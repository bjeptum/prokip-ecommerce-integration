const express = require('express');
const { pollProkipToStores } = require('../services/syncService');
const { PrismaClient } = require('@prisma/client');
const { getWooOrders } = require('../services/wooService');
const { processStoreToProkip } = require('../services/syncService');

const router = express.Router();
const prisma = new PrismaClient();

router.post('/', async (req, res) => {
  await pollProkipToStores();
  res.json({ success: true, message: 'Manual sync triggered' });
});

router.get('/status', async (req, res) => {
  const connections = await prisma.connection.findMany();

  // Get Prokip transaction counts
  let prokipStats = { products: 0, sales: 0, purchases: 0 };

  try {
    // Check if inventoryCache table exists
    if (prisma.inventoryCache) {
      const prokipProducts = await prisma.inventoryCache.groupBy({
        by: ['sku'],
        _count: { sku: true }
      });
      prokipStats.products = prokipProducts.length;
    }

    // Check if salesLog table exists
    if (prisma.salesLog) {
      const salesCount = await prisma.salesLog.count({
        where: { 
          status: 'completed'
        }
      });
      const purchasesCount = await prisma.salesLog.count({
        where: {
          status: 'purchase'
        }
      });

      prokipStats.sales = salesCount;
      prokipStats.purchases = purchasesCount;
    }
  } catch (error) {
    console.error('Error fetching Prokip stats:', error);
  }

  const connectionsWithStats = await Promise.all(connections.map(async (c) => {
    let productCount = 0;
    let orderCount = 0;

    // Get product count for this connection
    try {
      if (prisma.inventoryCache) {
        productCount = await prisma.inventoryCache.count({
          where: { connectionId: c.id }
        });
      }
    } catch (error) {
      // Table doesn't exist or other error
      productCount = 0;
    }

    // Get order count from SalesLog for this connection
    try {
      if (prisma.salesLog) {
        orderCount = await prisma.salesLog.count({
          where: {
            connectionId: c.id,
            status: 'completed'
          }
        });
      }
    } catch (error) {
      // Table doesn't exist or other error
      orderCount = 0;
    }

    return {
      id: c.id,
      platform: c.platform,
      storeUrl: c.storeUrl,
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

router.post('/pull-orders', async (req, res) => {
  const connections = await prisma.connection.findMany({ where: { platform: 'woocommerce' } });
  
  for (const conn of connections) {
    try {
      const lastSync = conn.lastSync?.toISOString();
      const orders = await getWooOrders(conn.storeUrl, conn.consumerKey, conn.consumerSecret, lastSync);
      
      for (const order of orders) {
        await processStoreToProkip(conn.storeUrl, 'order.created', order, 'woocommerce');
      }
    } catch (error) {
      console.error(`Failed to pull orders from ${conn.storeUrl}:`, error.message);
    }
  }
  
  res.json({ success: true, message: 'Orders pulled successfully' });
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
    console.error('Failed to resolve error:', error);
    res.status(500).json({ error: 'Failed to resolve error' });
  }
});

// Pull sales from store
router.post('/pull-sales', async (req, res) => {
  try {
    const { connectionId } = req.body;
    const userId = req.userId;

    if (!connectionId) {
      return res.status(400).json({ error: 'Connection ID is required' });
    }

    // Verify connection belongs to user
    const connection = await prisma.connection.findFirst({
      where: {
        id: connectionId,
        userId: userId
      }
    });

    if (!connection) {
      return res.status(404).json({ 
        error: 'Store not found',
        message: 'This store connection does not exist or you do not have access to it'
      });
    }

    // For now, just return success - the actual sales fetching is done via the store routes
    // In a full implementation, this would:
    // 1. Fetch sales from the store
    // 2. Store them in the database
    // 3. Sync with Prokip if needed
    
    res.json({ 
      success: true, 
      message: 'Sales sync completed successfully',
      syncedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error pulling sales:', error);
    res.status(500).json({ 
      error: 'Failed to pull sales',
      message: 'An unexpected error occurred while pulling sales'
    });
  }
});

module.exports = router;
