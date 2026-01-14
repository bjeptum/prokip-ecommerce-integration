const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prokipService = require('./prokipService');

const prisma = new PrismaClient();
const MOCK_PROKIP = process.env.MOCK_PROKIP === 'true';
const PROKIP_BASE = MOCK_PROKIP 
  ? (process.env.MOCK_PROKIP_URL || 'http://localhost:4000') + '/connector/api/'
  : process.env.PROKIP_API + '/connector/api/';

async function getProkipProductIdBySku(sku) {
  try {
    if (!MOCK_PROKIP) {
      // Use prokipService for real API
      const product = await prokipService.getProductBySku(sku);
      return product?.id || null;
    }
    
    // Mock mode - use direct API call
    const prokip = await prisma.prokipConfig.findUnique({ where: { id: 1 } });
    if (!prokip) return null;

    const headers = { Authorization: `Bearer ${prokip.token}`, Accept: 'application/json' };
    const response = await axios.get(`${PROKIP_BASE}product?sku=${encodeURIComponent(sku)}&per_page=-1`, { headers });
    const product = response.data.data.find(p => p.sku === sku);
    return product ? product.id : null;
  } catch (error) {
    console.error(`Failed to get Prokip product ID for SKU ${sku}:`, error.message);
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

    // Calculate unit price with tax
    const unitPrice = parseFloat(item.price);
    const taxPerUnit = platform === 'shopify' 
      ? (parseFloat(item.total_tax || 0) / item.quantity)
      : (parseFloat(item.total_tax || 0) / item.quantity);
    
    products.push({
      product_id: productId,
      variation_id: productId, // simplify
      quantity: item.quantity,
      unit_price: unitPrice,
      unit_price_inc_tax: unitPrice + taxPerUnit
    });
  }

  if (products.length === 0) return null;

  // Extract discount amount
  let discountAmount = 0;
  if (platform === 'shopify') {
    discountAmount = parseFloat(data.total_discounts || 0);
  } else if (platform === 'woocommerce') {
    discountAmount = parseFloat(data.discount_total || 0);
  }

  // Generate invoice number with platform prefix to distinguish sales sources
  const platformPrefix = {
    'shopify': 'SHOPIFY',
    'woocommerce': 'WOO',
    'prokip': 'PROKIP'
  };
  const prefix = platformPrefix[platform.toLowerCase()] || 'ONLINE';
  const orderId = (data.id || data.number || Date.now()).toString();
  const invoiceNo = `${prefix}-${orderId}`;

  return {
    sells: [{
      location_id: parseInt(locationId),
      contact_id: 1, // default walk-in
      transaction_date: new Date(data.created_at || data.date_created).toISOString().slice(0, 19).replace('T', ' '),
      invoice_no: invoiceNo,
      status: 'final',
      type: 'sell',
      payment_status: 'paid',
      final_total: parseFloat(data.total || data.total_price),
      discount_amount: discountAmount,
      discount_type: 'fixed',
      products,
      payments: [{
        method: 'cash',
        amount: parseFloat(data.total || data.total_price),
        paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
      }],
      // Add metadata for tracking
      platform_source: platform,
      platform_order_id: orderId
    }]
  };
}

/**
 * Map refund data to Prokip products (partial refunds only)
 */
function mapRefundToProkipProducts(data, platform) {
  const refundedProducts = [];

  if (platform === 'shopify') {
    // Shopify can have refunds in two structures:
    // 1. Direct refund webhook with refund_line_items
    // 2. orders/updated webhook with refunds array
    
    if (data.refund_line_items && Array.isArray(data.refund_line_items)) {
      // Direct refund webhook structure
      for (const refundItem of data.refund_line_items) {
        const lineItem = refundItem.line_item;
        if (lineItem && lineItem.sku) {
          refundedProducts.push({
            sku: lineItem.sku,
            quantity: refundItem.quantity,
            unit_price: parseFloat(lineItem.price || 0)
          });
        }
      }
    } else if (data.refunds && Array.isArray(data.refunds)) {
      // orders/updated webhook with refunds array
      for (const refund of data.refunds) {
        if (refund.refund_line_items && Array.isArray(refund.refund_line_items)) {
          for (const refundItem of refund.refund_line_items) {
            const lineItem = refundItem.line_item;
            if (lineItem && lineItem.sku) {
              refundedProducts.push({
                sku: lineItem.sku,
                quantity: refundItem.quantity,
                unit_price: parseFloat(lineItem.price || 0)
              });
            }
          }
        }
      }
    }
  } else if (platform === 'woocommerce') {
    // WooCommerce refund structure
    if (data.line_items && Array.isArray(data.line_items)) {
      for (const item of data.line_items) {
        if (item.sku && item.quantity < 0) {
          // Negative quantity indicates refund
          refundedProducts.push({
            sku: item.sku,
            quantity: Math.abs(item.quantity),
            unit_price: parseFloat(item.price || 0)
          });
        }
      }
    }
  }

  return refundedProducts;
}

/**
 * Map cancellation to full order products (all items)
 */
function mapCancellationProducts(data, platform) {
  const products = [];
  const lineItems = platform === 'shopify' ? data.line_items : data.line_items;

  for (const item of lineItems || []) {
    if (item.sku) {
      products.push({
        sku: item.sku,
        quantity: item.quantity,
        unit_price: parseFloat(item.price || 0)
      });
    }
  }

  return products;
}

module.exports = {
  mapOrderToProkipSell,
  mapRefundToProkipProducts,
  mapCancellationProducts,
  getProkipProductIdBySku
};
