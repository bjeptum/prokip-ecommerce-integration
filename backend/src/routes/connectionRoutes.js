const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { body, query, validationResult } = require('express-validator');
const bodyParser = require('body-parser');
const { registerShopifyWebhooks } = require('../services/shopifyService');
const { registerWooWebhooks } = require('../services/wooService');
const { processStoreToProkip } = require('../services/syncService');

const router = express.Router();
const prisma = new PrismaClient();

// Shopify OAuth start
router.get('/shopify', [
  query('store').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { store } = req.query;
  const state = crypto.randomBytes(16).toString('hex');
  const scopes = 'read_products,write_products,read_inventory,write_inventory,read_orders,write_orders';
  const redirectUri = process.env.REDIRECT_URI || `http://localhost:${process.env.PORT}/connections/callback/shopify`;

  const authorizeUrl = `https://${store}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_CLIENT_ID}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;
  res.redirect(authorizeUrl);
});

// Shopify OAuth callback
router.get('/callback/shopify', async (req, res) => {
  const { code, shop } = req.query;
  if (!code || !shop) return res.status(400).send('Missing parameters');

  try {
    const tokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      code,
    });

    const accessToken = tokenResponse.data.access_token;

    await prisma.connection.create({
      data: {
        platform: 'shopify',
        storeUrl: shop,
        accessToken
      }
    });

    await registerShopifyWebhooks(shop, accessToken);
    res.redirect('/?success=Shopify+connected');
  } catch (error) {
    console.error(error);
    res.status(500).send('Shopify connection failed');
  }
});

// Shopify webhook endpoint
router.post('/webhook/shopify', bodyParser.raw({ type: 'application/json' }), (req, res) => {
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

// WooCommerce connection
router.post('/woocommerce', [
  body('storeUrl').isURL(),
  body('consumerKey').notEmpty(),
  body('consumerSecret').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { storeUrl, consumerKey, consumerSecret } = req.body;

  try {
    await prisma.connection.create({
      data: {
        platform: 'woocommerce',
        storeUrl,
        consumerKey,
        consumerSecret
      }
    });

    await registerWooWebhooks(storeUrl, consumerKey, consumerSecret);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to connect WooCommerce' });
  }
});

// WooCommerce webhook
router.post('/webhook/woocommerce', (req, res) => {
  const data = req.body;
  const storeUrl = data.resource?.site_url || ''; // Adjust based on actual payload
  const topic = data.topic || 'order.created';

  processStoreToProkip(storeUrl, topic, data, 'woocommerce');
  res.status(200).send('OK');
});

// Set Prokip token & location
router.post('/prokip', [
  body('token').notEmpty(),
  body('locationId').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { token, locationId } = req.body;

  await prisma.prokipConfig.upsert({
    where: { id: 1 },
    update: { token, locationId },
    create: { id: 1, token, apiUrl: process.env.PROKIP_API, locationId }
  });

  res.json({ success: true });
});

// Get connections status
router.get('/status', async (req, res) => {
  const connections = await prisma.connection.findMany();
  res.json(connections);
});

// Disconnect store
router.post('/disconnect', [
  body('connectionId').isInt()
], async (req, res) => {
  const { connectionId } = req.body;
  await prisma.connection.delete({ where: { id: parseInt(connectionId) } });
  res.json({ success: true });
});

module.exports = router;
