const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const { processStoreToProkip } = require('../services/syncService');

const router = express.Router();

// Shopify webhook endpoint (public)
router.post('/shopify', bodyParser.raw({ type: 'application/json' }), (req, res) => {
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const topic = req.headers['x-shopify-topic'];
  const shop = req.headers['x-shopify-shop-domain'];

  const generatedHmac = crypto.createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET)
    .update(req.body)
    .digest('base64');

  if (generatedHmac !== hmac) return res.status(401).send('Invalid HMAC');

  const data = JSON.parse(req.body.toString());
  processStoreToProkip(shop, topic, data, 'shopify');

  res.status(200).send('OK');
});

// WooCommerce webhook endpoint (public)
router.post('/woocommerce', express.json(), (req, res) => {
  const signature = req.headers['x-wc-webhook-signature'];
  const topic = req.headers['x-wc-webhook-topic'] || req.body.topic || 'order.created';
  const source = req.headers['x-wc-webhook-source'];
  
  // Verify webhook signature if secret is configured
  const webhookSecret = process.env.WEBHOOK_SECRET || process.env.WOO_WEBHOOK_SECRET;
  if (webhookSecret && signature) {
    const generatedSignature = crypto.createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('base64');

    if (generatedSignature !== signature) {
      console.error('Invalid signature for WooCommerce webhook');
      return res.status(401).send('Invalid signature');
    }
  }

  const data = req.body;
  
  // Extract store URL from multiple possible sources
  let storeUrl = source || data.resource?.site_url || data.site_url || data.meta?.store_url || '';
  
  // If still no store URL, try to get it from the order data
  if (!storeUrl && data.id) {
    // For order webhooks, try to extract from the order itself
    storeUrl = data._links?.self?.[0]?.href ? 
      new URL(data._links.self[0].href).origin : '';
  }
  
  // Log webhook details for debugging
  console.log(`🔔 WooCommerce webhook received:`, {
    topic,
    storeUrl: storeUrl || 'UNKNOWN',
    orderId: data.id || data.number,
    source: source || 'NOT_PROVIDED'
  });

  if (!storeUrl) {
    console.error('Unable to determine store URL from WooCommerce webhook');
    return res.status(400).send('Store URL not found');
  }
  
  // Process webhook asynchronously to avoid timeout
  setImmediate(() => {
    processStoreToProkip(storeUrl, topic, data, 'woocommerce').catch(error => {
      console.error('WooCommerce webhook processing failed:', error);
    });
  });

  res.status(200).send('OK');
});

module.exports = router;

