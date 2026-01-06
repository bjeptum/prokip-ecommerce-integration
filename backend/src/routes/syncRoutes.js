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
  res.json(connections.map(c => ({
    id: c.id,
    platform: c.platform,
    storeUrl: c.storeUrl,
    lastSync: c.lastSync,
    syncEnabled: true // Add field if needed
  })));
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

module.exports = router;
