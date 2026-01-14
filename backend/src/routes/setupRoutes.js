const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { createProductInStore } = require('../services/storeService');
const { getShopifyProducts } = require('../services/shopifyService');
const { getWooProducts } = require('../services/wooService');
const { getProkipProductIdBySku } = require('../services/prokipMapper');
const prokipService = require('../services/prokipService');
const authenticateToken = require('../middlewares/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();
const MOCK_PROKIP = process.env.MOCK_PROKIP === 'true';
const PROKIP_BASE = MOCK_PROKIP 
  ? (process.env.MOCK_PROKIP_URL || 'http://localhost:4000') + '/connector/api/'
  : process.env.PROKIP_API + '/connector/api/';

router.get('/products', authenticateToken, async (req, res) => {
  const userId = req.userId;
  const connections = await prisma.connection.findMany({ where: { userId } });

  try {
    let prokipProducts = [];
    
    if (!MOCK_PROKIP) {
      // Use prokipService for real API
      const isAuthenticated = await prokipService.isAuthenticated(userId);
      if (!isAuthenticated) {
        return res.status(401).json({ error: 'Please log in to Prokip first' });
      }
      
      const products = await prokipService.getProducts(null, userId);
      prokipProducts = products.map(p => ({
        source: 'prokip',
        id: p.id,
        name: p.name,
        sku: p.sku,
        price: p.product_variations?.[0]?.variations?.[0]?.sell_price_inc_tax || 0,
        // Include full product data for detailed view
        product_variations: p.product_variations
      }));
    } else {
      // Mock mode
      const prokip = await prisma.prokipConfig.findFirst({ where: { userId } });
      if (!prokip?.token) {
        return res.status(400).json({ error: 'Prokip config missing - please login first' });
      }

      const headers = {
        Authorization: `Bearer ${prokip.token}`,
        Accept: 'application/json'
      };

      const prokipRes = await axios.get(PROKIP_BASE + 'product?per_page=-1', { headers });
      prokipProducts = prokipRes.data.data.map(p => ({
        source: 'prokip',
        id: p.id,
        name: p.name,
        sku: p.sku,
        price: p.product_variations?.[0]?.variations?.[0]?.sell_price_inc_tax || 0,
        product_variations: p.product_variations
      }));
    }

    const storeProducts = [];
    for (const conn of connections) {
      try {
        let products = [];
        if (conn.platform === 'shopify') {
          products = await getShopifyProducts(conn.storeUrl, conn.accessToken);
          products = products.map(p => ({
            source: 'store',
            connectionId: conn.id,
            platform: conn.platform,
            storeUrl: conn.storeUrl,
            id: p.id,
            name: p.title,
            sku: p.variants[0]?.sku,
            price: p.variants[0]?.price
          }));
        } else if (conn.platform === 'woocommerce') {
          products = await getWooProducts(conn.storeUrl, conn.consumerKey, conn.consumerSecret);
          products = products.map(p => ({
            source: 'store',
            connectionId: conn.id,
            platform: conn.platform,
            storeUrl: conn.storeUrl,
            id: p.id,
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

    // Also return data as array for the Prokip Operations page
    res.json({ 
      prokipProducts, 
      storeProducts,
      data: prokipProducts // For loadProkipProducts function compatibility
    });
  } catch (error) {
    console.error('Failed to fetch products:', error.message);
    res.status(500).json({ error: 'Could not load products. Please check your connection.' });
  }
});

// Get product matches (for product matching UI)
router.get('/products/matches', authenticateToken, async (req, res) => {
  const { connectionId } = req.query;
  const userId = req.userId;
  
  try {
    const connection = await prisma.connection.findFirst({ 
      where: { 
        id: parseInt(connectionId),
        userId: userId
      } 
    });

    if (!connection) {
      return res.status(400).json({ error: 'Invalid connection or access denied' });
    }

    // Get Prokip products - use service for real API
    let prokipProducts = [];
    
    if (!MOCK_PROKIP) {
      const isAuthenticated = await prokipService.isAuthenticated(userId);
      if (!isAuthenticated) {
        return res.status(401).json({ error: 'Please log in to Prokip first' });
      }
      
      prokipProducts = await prokipService.getProducts(null, userId);
    } else {
      const prokip = await prisma.prokipConfig.findFirst({ where: { userId } });
      if (!prokip?.token) {
        return res.status(400).json({ error: 'Prokip config missing' });
      }
      const headers = {
        Authorization: `Bearer ${prokip.token}`,
        Accept: 'application/json'
      };
      const prokipRes = await axios.get(PROKIP_BASE + 'product?per_page=-1', { headers });
      prokipProducts = prokipRes.data.data;
    }

    // Get store products
    let storeProducts = [];
    if (connection.platform === 'shopify') {
      storeProducts = await getShopifyProducts(connection.storeUrl, connection.accessToken);
    } else if (connection.platform === 'woocommerce') {
      storeProducts = await getWooProducts(connection.storeUrl, connection.consumerKey, connection.consumerSecret);
    }

    // Match by SKU
    const matches = [];
    const unmatched = { prokip: [], store: [] };

    prokipProducts.forEach(pp => {
      const storeMatch = storeProducts.find(sp => {
        const storeSku = connection.platform === 'shopify' ? sp.variants[0]?.sku : sp.sku;
        return storeSku === pp.sku;
      });

      if (storeMatch) {
        matches.push({
          sku: pp.sku,
          prokipProduct: {
            id: pp.id,
            name: pp.name,
            price: pp.product_variations?.[0]?.variations?.[0]?.sell_price_inc_tax || 0
          },
          storeProduct: {
            id: storeMatch.id,
            name: connection.platform === 'shopify' ? storeMatch.title : storeMatch.name,
            price: connection.platform === 'shopify' ? storeMatch.variants[0]?.price : storeMatch.regular_price
          },
          matched: true
        });
      } else {
        unmatched.prokip.push({
          id: pp.id,
          name: pp.name,
          sku: pp.sku
        });
      }
    });

    // Find unmatched store products
    storeProducts.forEach(sp => {
      const storeSku = connection.platform === 'shopify' ? sp.variants[0]?.sku : sp.sku;
      const prokipMatch = prokipProducts.find(pp => pp.sku === storeSku);
      
      if (!prokipMatch && storeSku) {
        unmatched.store.push({
          id: sp.id,
          name: connection.platform === 'shopify' ? sp.title : sp.name,
          sku: storeSku
        });
      }
    });

    res.json({ matches, unmatched });
  } catch (error) {
    console.error('Failed to match products:', error);
    res.status(500).json({ error: 'Failed to match products' });
  }
});

// Check product readiness for push
router.post('/products/readiness-check', authenticateToken, [
  body('connectionId').isInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { connectionId } = req.body;
  const userId = req.userId;
  
  try {
    const prokip = await prisma.prokipConfig.findFirst({ where: { userId } });
    
    if (!prokip?.token) {
      return res.status(400).json({ error: 'Prokip config missing - please login first' });
    }

  const headers = {
    Authorization: `Bearer ${prokip.token}`,
    Accept: 'application/json'
  };

  const response = await axios.get(PROKIP_BASE + 'product?per_page=-1', { headers });
  const products = response.data.data;

  const readinessReport = products.map(product => {
    const issues = [];
    const sellPrice = product.product_variations?.[0]?.variations?.[0]?.sell_price_inc_tax;
    
    if (!product.name) issues.push('Missing product name');
    if (!product.sku) issues.push('Missing SKU');
    if (!sellPrice || sellPrice <= 0) issues.push('Missing or invalid price');
    // Images are optional in this implementation
    
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      price: sellPrice || 0,
      ready: issues.length === 0,
      issues
    };
  });

  const readyCount = readinessReport.filter(p => p.ready).length;
  const totalCount = readinessReport.length;

  res.json({
    summary: {
      total: totalCount,
      ready: readyCount,
      needsAttention: totalCount - readyCount
    },
    products: readinessReport
  });
  } catch (error) {
    console.error('Failed to check product readiness:', error);
    res.status(500).json({ error: 'Failed to check product readiness' });
  }
});

router.post('/products', authenticateToken, [
  body('method').isIn(['push', 'pull']),
  body('connectionId').isInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { method, connectionId } = req.body;
  const userId = req.userId;
  const connection = await prisma.connection.findFirst({ 
    where: { 
      id: parseInt(connectionId),
      userId: userId
    } 
  });
  const prokip = await prisma.prokipConfig.findFirst({ where: { userId } });

  if (!connection || !prokip?.token) {
    return res.status(400).json({ error: 'Invalid connection or Prokip config' });
  }

  const headers = {
    Authorization: `Bearer ${prokip.token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  if (method === 'pull') {
    // Pull products from store to Prokip
    try {
      let storeProducts = [];
      
      if (connection.platform === 'shopify') {
        storeProducts = await getShopifyProducts(connection.storeUrl, connection.accessToken);
        storeProducts = storeProducts.map(p => ({
          name: p.title,
          sku: p.variants[0]?.sku || `SHOPIFY-${p.id}`,
          sell_price: parseFloat(p.variants[0]?.price || 0),
          purchase_price: parseFloat(p.variants[0]?.price || 0) * 0.7, // Estimate 30% margin
          initial_quantity: p.variants[0]?.inventory_quantity || 0
        }));
      } else if (connection.platform === 'woocommerce') {
        storeProducts = await getWooProducts(connection.storeUrl, connection.consumerKey, connection.consumerSecret);
        storeProducts = storeProducts.map(p => ({
          name: p.name,
          sku: p.sku || `WOO-${p.id}`,
          sell_price: parseFloat(p.regular_price || 0),
          purchase_price: parseFloat(p.regular_price || 0) * 0.7,
          initial_quantity: p.stock_quantity || 0
        }));
      }

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const product of storeProducts) {
        if (!product.name || !product.sku) {
          results.push({ sku: product.sku || 'unknown', status: 'skipped', reason: 'Missing name or SKU' });
          continue;
        }

        try {
          // Check if product already exists in Prokip
          const existingId = await getProkipProductIdBySku(product.sku);
          
          if (existingId) {
            results.push({ sku: product.sku, status: 'skipped', reason: 'Already exists in Prokip' });
            continue;
          }

          // Create product in Prokip
          await axios.post(PROKIP_BASE + 'product', {
            ...product,
            location_id: prokip.locationId
          }, { headers });

          // Create inventory log entry
          await prisma.inventoryLog.create({
            data: {
              connectionId: connection.id,
              productId: product.id?.toString() || product.sku,
              productName: product.name,
              sku: product.sku,
              quantity: product.initial_quantity || 0,
              price: parseFloat(product.sell_price_inc_tax || product.price || 0)
            }
          });

          results.push({ sku: product.sku, status: 'success' });
          successCount++;
        } catch (error) {
          console.error(`Failed to create product ${product.sku}:`, error.response?.data || error.message);
          results.push({ 
            sku: product.sku, 
            status: 'error', 
            error: error.response?.data?.message || error.message 
          });
          errorCount++;
        }

        // Rate limit: wait 300ms between requests
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      res.json({ 
        success: true, 
        message: `Pull complete: ${successCount} products created, ${errorCount} errors`,
        results
      });
    } catch (error) {
      console.error('Pull failed:', error);
      res.status(500).json({ error: 'Pull failed', details: error.message });
    }
  }

  if (method === 'push') {
    try {
      const response = await axios.get(PROKIP_BASE + 'product?per_page=-1', { headers });
      const products = response.data.data;

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const product of products) {
        if (!product.name || !product.sku) {
          results.push({ sku: product.sku || 'unknown', status: 'skipped', reason: 'Missing name or SKU' });
          continue;
        }

        // Extract stock quantity from Prokip product structure
        // Try multiple paths where qty_available might be stored
        let stockQuantity = 0;
        const variation = product.product_variations?.[0]?.variations?.[0];
        if (variation) {
          // Check variation_location_details first (location-specific stock)
          if (variation.variation_location_details && variation.variation_location_details.length > 0) {
            stockQuantity = parseFloat(variation.variation_location_details[0]?.qty_available || 0);
          } else {
            // Fall back to direct qty_available on variation
            stockQuantity = parseFloat(variation.qty_available || 0);
          }
        }
        
        console.log(`📦 Prokip product "${product.name}" (SKU: ${product.sku}) - Stock: ${stockQuantity}`);

        const storeProduct = {
          title: product.name,
          name: product.name,
          sku: product.sku,
          price: product.product_variations?.[0]?.variations?.[0]?.sell_price_inc_tax || 0,
          stock_quantity: Math.floor(stockQuantity) // Use actual stock from Prokip
        };

        try {
          await createProductInStore(connection, storeProduct);
          
          // Create or update inventory log entry with actual stock quantity
          await prisma.inventoryLog.upsert({
            where: {
              connectionId_sku: {
                connectionId: connection.id,
                sku: product.sku
              }
            },
            update: {
              productId: product.id?.toString() || product.sku,
              productName: product.name,
              quantity: Math.floor(stockQuantity), // Update with actual stock
              price: parseFloat(product.product_variations?.[0]?.variations?.[0]?.sell_price_inc_tax || 0)
            },
            create: {
              connectionId: connection.id,
              productId: product.id?.toString() || product.sku,
              productName: product.name,
              sku: product.sku,
              quantity: Math.floor(stockQuantity), // Use actual stock from Prokip
              price: parseFloat(product.product_variations?.[0]?.variations?.[0]?.sell_price_inc_tax || 0)
            }
          });

          results.push({ sku: product.sku, status: 'success', stock: Math.floor(stockQuantity) });
          successCount++;
        } catch (error) {
          console.error(`Failed to push product ${product.sku}:`, error.message);
          results.push({ 
            sku: product.sku, 
            status: 'error', 
            error: error.message 
          });
          errorCount++;
        }
        
        // Rate limit: wait 500ms between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      res.json({ 
        success: true, 
        message: `Push complete: ${successCount} products created, ${errorCount} errors`,
        results
      });
    } catch (error) {
      console.error('Push failed:', error);
      res.status(500).json({ error: 'Push failed', details: error.message });
    }
  }
});

module.exports = router;
