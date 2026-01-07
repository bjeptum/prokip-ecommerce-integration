const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { createProductInStore, updateInventoryInStore } = require('../services/storeService');

const router = express.Router();
const prisma = new PrismaClient();
const MOCK_PROKIP = process.env.MOCK_PROKIP === 'true';
const PROKIP_BASE = MOCK_PROKIP 
  ? (process.env.MOCK_PROKIP_URL || 'http://localhost:4000') + '/connector/api/'
  : process.env.PROKIP_API + '/connector/api/';

/**
 * Create product in Prokip and sync to connected stores
 */
router.post('/products', [
  body('name').notEmpty(),
  body('sku').notEmpty(),
  body('sellPrice').isNumeric(),
  body('purchasePrice').optional().isNumeric(),
  body('quantity').optional().isNumeric()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, sku, sellPrice, purchasePrice, quantity } = req.body;
  const prokip = await prisma.prokipConfig.findUnique({ where: { id: 1 } });

  if (!prokip?.token || !prokip?.locationId) {
    return res.status(400).json({ error: 'Prokip config not found' });
  }

  const headers = {
    Authorization: `Bearer ${prokip.token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  try {
    // Create product in Prokip
    const response = await axios.post(PROKIP_BASE + 'product', {
      name,
      sku,
      sell_price: parseFloat(sellPrice),
      purchase_price: parseFloat(purchasePrice || 0),
      initial_quantity: parseInt(quantity || 0),
      location_id: prokip.locationId
    }, { headers });

    const createdProduct = response.data.data;

    // Sync to all connected stores
    const connections = await prisma.connection.findMany();
    const syncResults = [];

    for (const conn of connections) {
      try {
        const storeProduct = {
          title: name,
          name,
          sku,
          price: parseFloat(sellPrice),
          stock_quantity: parseInt(quantity || 0)
        };

        await createProductInStore(conn, storeProduct);
        
        // Create inventory cache entry
        await prisma.inventoryCache.upsert({
          where: {
            connectionId_sku: {
              connectionId: conn.id,
              sku
            }
          },
          update: {
            quantity: parseInt(quantity || 0)
          },
          create: {
            connectionId: conn.id,
            sku,
            quantity: parseInt(quantity || 0)
          }
        });

        syncResults.push({
          store: conn.storeUrl,
          platform: conn.platform,
          status: 'success'
        });
      } catch (error) {
        console.error(`Failed to sync product to ${conn.platform} store:`, error.message);
        syncResults.push({
          store: conn.storeUrl,
          platform: conn.platform,
          status: 'failed',
          error: error.message
        });
      }
    }

    res.status(201).json({
      success: true,
      product: createdProduct,
      syncResults,
      message: 'Product created in Prokip and synced to stores'
    });
  } catch (error) {
    console.error('Failed to create product in Prokip:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to create product',
      details: error.response?.data || error.message
    });
  }
});

/**
 * Record sale in Prokip and reduce inventory in connected stores
 */
router.post('/sales', [
  body('products').isArray(),
  body('products.*.sku').notEmpty(),
  body('products.*.quantity').isNumeric(),
  body('products.*.unitPrice').isNumeric()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { products, customerName, paymentMethod } = req.body;
  const prokip = await prisma.prokipConfig.findUnique({ where: { id: 1 } });

  if (!prokip?.token || !prokip?.locationId) {
    return res.status(400).json({ error: 'Prokip config not found' });
  }

  const headers = {
    Authorization: `Bearer ${prokip.token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  try {
    // Get Prokip product IDs for the SKUs
    const productsResponse = await axios.get(PROKIP_BASE + 'product?per_page=-1', { headers });
    const prokipProducts = productsResponse.data.data;

    const sellProducts = [];
    let finalTotal = 0;

    for (const item of products) {
      const prokipProduct = prokipProducts.find(p => p.sku === item.sku);
      if (!prokipProduct) {
        return res.status(400).json({ error: `Product with SKU ${item.sku} not found in Prokip` });
      }

      const quantity = parseInt(item.quantity);
      const unitPrice = parseFloat(item.unitPrice);
      const subtotal = quantity * unitPrice;
      finalTotal += subtotal;

      sellProducts.push({
        product_id: prokipProduct.id,
        variation_id: prokipProduct.id,
        quantity,
        unit_price: unitPrice,
        unit_price_inc_tax: unitPrice
      });
    }

    // Create sale in Prokip
    const sellBody = {
      sells: [{
        location_id: parseInt(prokip.locationId),
        contact_id: 1,
        transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        invoice_no: `MANUAL-${Date.now()}`,
        status: 'final',
        type: 'sell',
        payment_status: 'paid',
        final_total: finalTotal,
        products: sellProducts,
        payments: [{
          method: paymentMethod || 'cash',
          amount: finalTotal,
          paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
        }]
      }]
    };

    const saleResponse = await axios.post(PROKIP_BASE + 'sell', sellBody, { headers });

    // Record the manual sale in SalesLog (without connectionId since it's a Prokip operation)
    await prisma.salesLog.create({
      data: {
        connectionId: 0, // Use 0 for Prokip operations not tied to a specific store
        orderId: `MANUAL-${Date.now()}`,
        prokipSellId: saleResponse.data.id?.toString(),
        operationType: 'sale',
        timestamp: new Date()
      }
    });

    // Update inventory in all connected stores
    const connections = await prisma.connection.findMany();
    const syncResults = [];

    for (const conn of connections) {
      for (const product of products) {
        try {
          // Get current inventory from cache
          const cache = await prisma.inventoryCache.findFirst({
            where: {
              connectionId: conn.id,
              sku: product.sku
            }
          });

          if (cache) {
            const newQuantity = cache.quantity - parseInt(product.quantity);
            await updateInventoryInStore(conn, product.sku, newQuantity);
            
            await prisma.inventoryCache.update({
              where: { id: cache.id },
              data: { quantity: newQuantity }
            });

            syncResults.push({
              store: conn.storeUrl,
              sku: product.sku,
              status: 'success',
              newQuantity
            });
          }
        } catch (error) {
          console.error(`Failed to update inventory for ${product.sku}:`, error.message);
          syncResults.push({
            store: conn.storeUrl,
            sku: product.sku,
            status: 'failed',
            error: error.message
          });
        }
      }
    }

    res.status(201).json({
      success: true,
      sale: saleResponse.data,
      syncResults,
      message: 'Sale recorded and inventory updated in stores'
    });
  } catch (error) {
    console.error('Failed to record sale:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to record sale',
      details: error.response?.data || error.message
    });
  }
});

/**
 * Record purchase in Prokip and increase inventory in connected stores
 */
router.post('/purchases', [
  body('products').isArray(),
  body('products.*.sku').notEmpty(),
  body('products.*.quantity').isNumeric(),
  body('products.*.unitCost').isNumeric()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { products, supplierName, referenceNo } = req.body;
  const prokip = await prisma.prokipConfig.findUnique({ where: { id: 1 } });

  if (!prokip?.token || !prokip?.locationId) {
    return res.status(400).json({ error: 'Prokip config not found' });
  }

  const headers = {
    Authorization: `Bearer ${prokip.token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  try {
    // Get Prokip product IDs for the SKUs
    const productsResponse = await axios.get(PROKIP_BASE + 'product?per_page=-1', { headers });
    const prokipProducts = productsResponse.data.data;

    const purchaseItems = [];

    for (const item of products) {
      const prokipProduct = prokipProducts.find(p => p.sku === item.sku);
      if (!prokipProduct) {
        return res.status(400).json({ error: `Product with SKU ${item.sku} not found in Prokip` });
      }

      purchaseItems.push({
        product_id: prokipProduct.id,
        sku: item.sku,
        quantity: parseInt(item.quantity),
        unit_cost: parseFloat(item.unitCost)
      });
    }

    // Create purchase in Prokip
    const purchaseBody = {
      location_id: prokip.locationId,
      supplier_id: supplierName || 'default',
      transaction_date: new Date().toISOString(),
      reference_no: referenceNo || `PURCHASE-${Date.now()}`,
      items: purchaseItems
    };

    const purchaseResponse = await axios.post(PROKIP_BASE + 'purchase', purchaseBody, { headers });

    // Record the manual purchase in SalesLog
    await prisma.salesLog.create({
      data: {
        connectionId: 0, // Use 0 for Prokip operations not tied to a specific store
        orderId: `PURCHASE-${Date.now()}`,
        prokipSellId: purchaseResponse.data.id?.toString(),
        operationType: 'purchase',
        timestamp: new Date()
      }
    });

    // Update inventory in all connected stores
    const connections = await prisma.connection.findMany();
    const syncResults = [];

    for (const conn of connections) {
      for (const product of products) {
        try {
          // Get current inventory from cache
          let cache = await prisma.inventoryCache.findFirst({
            where: {
              connectionId: conn.id,
              sku: product.sku
            }
          });

          if (!cache) {
            // Create cache entry if doesn't exist
            cache = await prisma.inventoryCache.create({
              data: {
                connectionId: conn.id,
                sku: product.sku,
                quantity: 0
              }
            });
          }

          const newQuantity = cache.quantity + parseInt(product.quantity);
          await updateInventoryInStore(conn, product.sku, newQuantity);
          
          await prisma.inventoryCache.update({
            where: { id: cache.id },
            data: { quantity: newQuantity }
          });

          syncResults.push({
            store: conn.storeUrl,
            sku: product.sku,
            status: 'success',
            newQuantity
          });
        } catch (error) {
          console.error(`Failed to update inventory for ${product.sku}:`, error.message);
          syncResults.push({
            store: conn.storeUrl,
            sku: product.sku,
            status: 'failed',
            error: error.message
          });
        }
      }
    }

    res.status(201).json({
      success: true,
      purchase: purchaseResponse.data,
      syncResults,
      message: 'Purchase recorded and inventory updated in stores'
    });
  } catch (error) {
    console.error('Failed to record purchase:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to record purchase',
      details: error.response?.data || error.message
    });
  }
});

module.exports = router;
