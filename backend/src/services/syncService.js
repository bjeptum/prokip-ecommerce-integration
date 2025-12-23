const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { updateInventoryInStore } = require('./storeService');
const { mapOrderToProkipSell, mapRefundToProkipProducts } = require('./prokipMapper');

const prisma = new PrismaClient();
const PROKIP_BASE = process.env.PROKIP_API + '/connector/api/';

async function processStoreToProkip(storeUrl, topic, data, platform) {
  const prokip = await prisma.prokipConfig.findUnique({ where: { id: 1 } });
  if (!prokip || !prokip.token || !prokip.locationId) return;

  const connection = await prisma.connection.findFirst({ where: { storeUrl } });
  if (!connection) return;

  const headers = {
    Authorization: `Bearer ${prokip.token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  if (topic.includes('order.create') || topic.includes('order.paid') || topic === 'order.created') {
    const sellBody = await mapOrderToProkipSell(data, prokip.locationId, platform);
    if (!sellBody) return;

    try {
      const response = await axios.post(PROKIP_BASE + 'sell', sellBody, { headers });
      await prisma.salesLog.create({
        data: {
          connectionId: connection.id,
          orderId: data.id?.toString() || data.number,
          prokipSellId: response.data.id?.toString(),
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Prokip sell failed:', error.response?.data || error.message);
    }
  } else if (topic.includes('order.refunded') || topic.includes('order.cancelled')) {
    const log = await prisma.salesLog.findFirst({ where: { orderId: data.id?.toString() } });
    if (!log?.prokipSellId) return;

    const returnBody = {
      transaction_id: log.prokipSellId,
      transaction_date: new Date().toISOString(),
      products: mapRefundToProkipProducts(data, platform),
      discount_amount: 0,
      discount_type: 'fixed'
    };

    try {
      await axios.post(PROKIP_BASE + 'sell-return', returnBody, { headers });
    } catch (error) {
      console.error('Prokip return failed:', error.response?.data || error.message);
    }
  }

  await prisma.connection.update({
    where: { id: connection.id },
    data: { lastSync: new Date() }
  });
}

async function pollProkipToStores() {
  const prokip = await prisma.prokipConfig.findUnique({ where: { id: 1 } });
  if (!prokip || !prokip.token) return;

  const headers = { Authorization: `Bearer ${prokip.token}`, Accept: 'application/json' };

  try {
    const response = await axios.get(PROKIP_BASE + 'product-stock-report', { headers });
    const stockData = response.data; // array of stock items

    const connections = await prisma.connection.findMany();

    for (const conn of connections) {
      const caches = await prisma.inventoryCache.findMany({ where: { connectionId: conn.id } });

      for (const item of stockData) {
        const cache = caches.find(c => c.sku === item.sku);
        const currentQty = parseInt(item.stock || item.qty_available || 0);

        if (cache && cache.quantity !== currentQty) {
          await updateInventoryInStore(conn, item.sku, currentQty);
          await prisma.inventoryCache.update({
            where: { id: cache.id },
            data: { quantity: currentQty }
          });
        } else if (!cache) {
          await prisma.inventoryCache.create({
            data: { connectionId: conn.id, sku: item.sku, quantity: currentQty }
          });
        }
      }
    }
  } catch (error) {
    console.error('Polling Prokip stock failed:', error.response?.data || error.message);
  }
}

module.exports = { processStoreToProkip, pollProkipToStores };
