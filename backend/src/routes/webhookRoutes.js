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
  const storeUrl = source || data.resource?.site_url || data.site_url || '';
  
  // Process webhook asynchronously to avoid timeout
  setImmediate(() => {
    processStoreToProkip(storeUrl, topic, data, 'woocommerce').catch(error => {
      console.error('WooCommerce webhook processing failed:', error);
    });
  });

  res.status(200).send('OK');
});

module.exports = router;

