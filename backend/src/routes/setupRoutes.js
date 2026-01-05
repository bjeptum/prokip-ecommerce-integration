const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { createProductInStore } = require('../services/storeService');
const { getShopifyProducts } = require('../services/shopifyService');
const { getWooProducts } = require('../services/wooService');

const router = express.Router();
const prisma = new PrismaClient();
const MOCK_PROKIP = process.env.MOCK_PROKIP === 'true';
const PROKIP_BASE = MOCK_PROKIP 
  ? (process.env.MOCK_PROKIP_URL || 'http://localhost:4000') + '/connector/api/'
  : process.env.PROKIP_API + '/connector/api/';

router.get('/products', async (req, res) => {
  const connections = await prisma.connection.findMany();
  const prokip = await prisma.prokipConfig.findUnique({ where: { id: 1 } });

  if (!prokip?.token) {
    return res.status(400).json({ error: 'Prokip config missing' });
  }

  const headers = {
    Authorization: `Bearer ${prokip.token}`,
    Accept: 'application/json'
  };

  try {
    const prokipRes = await axios.get(PROKIP_BASE + 'product?per_page=-1', { headers });
    const prokipProducts = prokipRes.data.data.map(p => ({
      source: 'prokip',
      name: p.name,
      sku: p.sku,
      price: p.product_variations?.[0]?.variations?.[0]?.sell_price_inc_tax || 0
    }));

    const storeProducts = [];
    for (const conn of connections) {
      try {
        let products = [];
        if (conn.platform === 'shopify') {
          products = await getShopifyProducts(conn.storeUrl, conn.accessToken);
          products = products.map(p => ({
            source: 'store',
            connectionId: conn.id,
            name: p.title,
            sku: p.variants[0]?.sku,
            price: p.variants[0]?.price
          }));
        } else if (conn.platform === 'woocommerce') {
          products = await getWooProducts(conn.storeUrl, conn.consumerKey, conn.consumerSecret);
          products = products.map(p => ({
            source: 'store',
            connectionId: conn.id,
            name: p.name,
            sku: p.sku,
            price: p.regular_price
          }));
        }
        storeProducts.push(...products);
      } catch (error) {
        console.error(`Failed to fetch products from ${conn.platform}:`, error.message);
      }
    }

    res.json({ prokipProducts, storeProducts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.post('/products', [
  body('method').isIn(['push', 'pull']),
  body('connectionId').isInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { method, connectionId } = req.body;
  const connection = await prisma.connection.findUnique({ where: { id: parseInt(connectionId) } });
  const prokip = await prisma.prokipConfig.findUnique({ where: { id: 1 } });

  if (!connection || !prokip?.token) {
    return res.status(400).json({ error: 'Invalid connection or Prokip config' });
  }

  const headers = {
    Authorization: `Bearer ${prokip.token}`,
    Accept: 'application/json'
  };

  if (method === 'pull') {
    return res.json({ success: false, message: 'Pull not supported - no product creation endpoint in Prokip API' });
  }

  if (method === 'push') {
    try {
      const response = await axios.get(PROKIP_BASE + 'product?per_page=-1', { headers });
      const products = response.data.data;

      for (const product of products) {
        if (!product.name || !product.sku) continue;

        const storeProduct = {
          title: product.name,
          name: product.name,
          sku: product.sku,
          price: product.product_variations?.[0]?.variations?.[0]?.sell_price_inc_tax || 0
        };

        await createProductInStore(connection, storeProduct);
        
        // Rate limit: wait 500ms between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      res.json({ success: true, message: 'Products pushed successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Push failed' });
    }
  }
});

module.exports = router;
