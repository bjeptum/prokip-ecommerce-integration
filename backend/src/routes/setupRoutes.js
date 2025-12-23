const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { createProductInStore } = require('../services/storeService');

const router = express.Router();
const prisma = new PrismaClient();
const PROKIP_BASE = process.env.PROKIP_API + '/connector/api/';

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
      }

      res.json({ success: true, message: 'Products pushed successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Push failed' });
    }
  }
});

module.exports = router;
