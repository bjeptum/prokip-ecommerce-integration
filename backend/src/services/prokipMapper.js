const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PROKIP_BASE = process.env.PROKIP_API + '/connector/api/';

async function getProkipProductIdBySku(sku) {
  const prokip = await prisma.prokipConfig.findUnique({ where: { id: 1 } });
  if (!prokip) return null;

  const headers = { Authorization: `Bearer ${prokip.token}`, Accept: 'application/json' };

  try {
    const response = await axios.get(`${PROKIP_BASE}product?sku=${sku}&per_page=-1`, { headers });
    const product = response.data.data.find(p => p.sku === sku);
    return product ? product.id : null;
  } catch (error) {
    return null;
  }
}

async function mapOrderToProkipSell(data, locationId, platform) {
  const products = [];
  const lineItems = platform === 'shopify' ? data.line_items : data.line_items;

  for (const item of lineItems) {
    if (!item.sku) continue;
    const productId = await getProkipProductIdBySku(item.sku);
    if (!productId) continue;

    products.push({
      product_id: productId,
      variation_id: productId, // simplify
      quantity: item.quantity,
      unit_price: parseFloat(item.price),
      unit_price_inc_tax: parseFloat(item.price) + (parseFloat(item.total_tax || 0) / item.quantity)
    });
  }

  if (products.length === 0) return null;

  return {
    sells: [{
      location_id: parseInt(locationId),
      contact_id: 1, // default walk-in
      transaction_date: new Date(data.created_at || data.date_created).toISOString().slice(0, 19).replace('T', ' '),
      invoice_no: (data.id || data.number).toString(),
      status: 'final',
      type: 'sell',
      payment_status: 'paid',
      final_total: parseFloat(data.total || data.total_price),
      products,
      payments: [{
        method: 'cash',
        amount: parseFloat(data.total || data.total_price),
        paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
      }]
    }]
  };
}

function mapRefundToProkipProducts(data, platform) {
  // Simplified - implement based on actual refund data
  return [];
}

module.exports = {
  mapOrderToProkipSell,
  mapRefundToProkipProducts,
  getProkipProductIdBySku
};
