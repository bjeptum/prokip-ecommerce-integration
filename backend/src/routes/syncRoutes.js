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

module.exports = router;
