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
  const data = req.body;
  const storeUrl = data.resource?.site_url || data.site_url || '';
  const topic = data.topic || 'order.created';

  processStoreToProkip(storeUrl, topic, data, 'woocommerce');
  res.status(200).send('OK');
});

module.exports = router;

