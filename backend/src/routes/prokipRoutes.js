const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { createProductInStore, updateInventoryInStore } = require('../services/storeService');
const prokipService = require('../services/prokipService');
const authenticateToken = require('../middlewares/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();
const MOCK_PROKIP = process.env.MOCK_PROKIP === 'true';
const PROKIP_BASE = MOCK_PROKIP 
  ? (process.env.MOCK_PROKIP_URL || 'http://localhost:4000') + '/connector/api/'
  : process.env.PROKIP_API + '/connector/api/';

/**
 * Helper to get Prokip headers (handles real vs mock API)
 */
async function getHeaders(userId = null) {
  if (!MOCK_PROKIP) {
    return await prokipService.getAuthHeaders(userId);
  }
  
  // For mock API, get current user's config
  const whereClause = userId ? { userId } : { id: 1 };
  const prokip = await prisma.prokipConfig.findFirst({ where: whereClause });
  
  return {
    Authorization: `Bearer ${prokip?.token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
}

/**
 * Get products from Prokip
 */
router.get('/products', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    console.log('🔍 Getting Prokip products for user:', userId);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Get user's Prokip config to get locationId
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId }
    });
    
    if (!prokipConfig) {
      return res.status(404).json({ error: 'No Prokip configuration found for this user' });
    }
    
    let products;
    
    if (!MOCK_PROKIP) {
      // Use prokipService for real API with locationId
      console.log('📡 Using real Prokip API (not mock)');
      console.log('📍 Location ID:', prokipConfig.locationId);
      products = await prokipService.getProducts(prokipConfig.locationId, userId);
    } else {
      console.log('📡 Using mock Prokip API');
      console.log('📍 Location ID:', prokipConfig.locationId);
      const headers = await getHeaders(userId);
      
      // Add locationId to the API call
      let url = PROKIP_BASE + 'product?per_page=-1';
      if (prokipConfig.locationId) {
        url += `&location_id=${prokipConfig.locationId}`;
      }
      
      const response = await axios.get(url, { headers });
      products = response.data.data || [];
    }
    
    console.log('📦 Prokip products loaded:', products.length);
    console.log('📦 Sample product:', products[0]);
    
    // Add location information to each product
    products = products.map(product => ({
      ...product,
      locationId: prokipConfig.locationId,
      userId: userId
    }));
    
    res.json({ 
      products: products,
      locationId: prokipConfig.locationId,
      userId: userId
    });
  } catch (error) {
    console.error('❌ Failed to fetch products:', error.message);
    console.error('❌ Full error object:', error);
    console.error('❌ Error response:', error.response?.data);
    res.status(500).json({ 
      error: 'Could not load products from Prokip',
      details: error.message 
    });
  }
});

/**
 * Get inventory/stock from Prokip
 */
router.get('/inventory', async (req, res) => {
  try {
    let inventory;
    
    if (!MOCK_PROKIP) {
      // Use prokipService for real API
      inventory = await prokipService.getInventory();
    } else {
      const headers = await getHeaders();
      const response = await axios.get(PROKIP_BASE + 'product-stock-report', { headers });
      inventory = response.data.data || response.data || [];
    }
    
    res.json({ success: true, inventory });
  } catch (error) {
    console.error('Failed to fetch inventory:', error.message);
    res.status(500).json({ 
      error: 'Could not load inventory from Prokip',
      details: error.message 
    });
  }
});

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
  
  try {
    let createdProduct;
    let headers;
    
    if (!MOCK_PROKIP) {
      // Use prokipService for real API
      createdProduct = await prokipService.createProduct({
        name,
        sku,
        sellPrice,
        purchasePrice,
        quantity
      });
      headers = await prokipService.getAuthHeaders();
    } else {
      const prokip = await prisma.prokipConfig.findUnique({ where: { id: 1 } });
      if (!prokip?.token || !prokip?.locationId) {
        return res.status(400).json({ error: 'Prokip not configured. Please log in first.' });
      }
      
      headers = {
        Authorization: `Bearer ${prokip.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      };
      
      const response = await axios.post(PROKIP_BASE + 'product', {
        name,
        sku,
        sell_price: parseFloat(sellPrice),
        purchase_price: parseFloat(purchasePrice || 0),
        initial_quantity: parseInt(quantity || 0),
        location_id: prokip.locationId
      }, { headers });
      
      createdProduct = response.data.data;
    }

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
        
        // Create inventory log entry
        await prisma.inventoryLog.create({
          data: {
            connectionId: conn.id,
            productId: createdProduct?.id?.toString() || sku,
            productName: name,
            sku,
            quantity: parseInt(quantity || 0),
            price: parseFloat(sellPrice)
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
      error: 'Could not create product. Please try again.',
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
  
  let headers;
  let locationId;
  
  try {
    if (!MOCK_PROKIP) {
      const isAuthenticated = await prokipService.isAuthenticated();
      if (!isAuthenticated) {
        return res.status(401).json({ error: 'Please log in to Prokip first' });
      }
      headers = await prokipService.getAuthHeaders();
      const config = await prokipService.getProkipConfig();
      locationId = config?.locationId;
    } else {
      const prokip = await prisma.prokipConfig.findUnique({ where: { id: 1 } });
      if (!prokip?.token || !prokip?.locationId) {
        return res.status(400).json({ error: 'Prokip not configured' });
      }
      headers = {
        Authorization: `Bearer ${prokip.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      };
      locationId = prokip.locationId;
    }

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
        location_id: parseInt(locationId),
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
        orderNumber: `MANUAL-${Date.now()}`,
        customerName: 'Walk-in Customer',
        totalAmount: parseFloat(total),
        status: 'completed',
        orderDate: new Date()
      }
    });

    // Update inventory in all connected stores
    const connections = await prisma.connection.findMany();
    const syncResults = [];

    for (const conn of connections) {
      for (const product of products) {
        try {
          // Get current inventory from log
          const inventoryLog = await prisma.inventoryLog.findFirst({
            where: {
              connectionId: conn.id,
              sku: product.sku
            }
          });

          if (inventoryLog) {
            const newQuantity = inventoryLog.quantity - parseInt(product.quantity);
            await updateInventoryInStore(conn, product.sku, newQuantity);
            
            await prisma.inventoryLog.update({
              where: { id: inventoryLog.id },
              data: { 
                quantity: newQuantity,
                lastSynced: new Date()
              }
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
        orderNumber: `PURCHASE-${Date.now()}`,
        customerName: supplier?.name || 'Unknown Supplier',
        totalAmount: parseFloat(total),
        status: 'completed',
        orderDate: new Date()
      }
    });

    // Update inventory in all connected stores
    const connections = await prisma.connection.findMany();
    const syncResults = [];

    for (const conn of connections) {
      for (const product of products) {
        try {
          // Get current inventory from log
          let inventoryLog = await prisma.inventoryLog.findFirst({
            where: {
              connectionId: conn.id,
              sku: product.sku
            }
          });

          if (!inventoryLog) {
            // Create log entry if doesn't exist
            inventoryLog = await prisma.inventoryLog.create({
              data: {
                connectionId: conn.id,
                productId: product.product_id?.toString() || product.sku,
                productName: product.name || 'Unknown Product',
                sku: product.sku,
                quantity: 0,
                price: parseFloat(product.unit_price || 0)
              }
            });
          }

          const newQuantity = inventoryLog.quantity + parseInt(product.quantity);
          await updateInventoryInStore(conn, product.sku, newQuantity);
          
          await prisma.inventoryLog.update({
            where: { id: inventoryLog.id },
            data: { 
              quantity: newQuantity,
              lastSynced: new Date()
            }
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

/**
 * Get sales from Prokip
 */
router.get('/sales', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    console.log('🔍 Getting Prokip sales for user:', userId);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Get user's Prokip config to get locationId
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId }
    });
    
    if (!prokipConfig) {
      return res.status(404).json({ error: 'No Prokip configuration found for this user' });
    }
    
    let sales;
    
    if (!MOCK_PROKIP) {
      // Use prokipService for real API
      const { startDate, endDate } = req.query;
      console.log('📊 Fetching sales with params:', { 
        startDate, 
        endDate, 
        locationId: prokipConfig.locationId 
      });
      
      // Get sales from real Prokip API with locationId
      const headers = await prokipService.getAuthHeaders(userId);
      let url = `${process.env.PROKIP_API}/connector/api/sell?per_page=-1`;
      if (prokipConfig.locationId) {
        url += `&location_id=${prokipConfig.locationId}`;
      }
      if (startDate) {
        url += `&start_date=${startDate}`;
      }
      if (endDate) {
        url += `&end_date=${endDate}`;
      }
      
      const response = await axios.get(url, { headers });
      sales = response.data.data || [];
      
      console.log('📦 Sales loaded from real API:', sales.length);
    } else {
      // Use mock API
      const headers = await getHeaders(userId);
      let url = PROKIP_BASE + 'sell?per_page=-1';
      if (prokipConfig.locationId) {
        url += `&location_id=${prokipConfig.locationId}`;
      }
      
      const response = await axios.get(url, { headers });
      sales = response.data.data || [];
    }
    
    // Add location information to each sale
    sales = sales.map(sale => ({
      ...sale,
      locationId: prokipConfig.locationId,
      userId: userId
    }));
    
    res.json({ 
      success: true, 
      sales,
      locationId: prokipConfig.locationId,
      userId: userId
    });
  } catch (error) {
    console.error('Failed to fetch sales:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ 
      error: 'Could not load sales from Prokip',
      details: error.message 
    });
  }
});

/**
 * Get purchases from Prokip
 */
router.get('/purchases', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    console.log('🔍 Getting Prokip purchases for user:', userId);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Get user's Prokip config to get locationId
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId }
    });
    
    if (!prokipConfig) {
      return res.status(404).json({ error: 'No Prokip configuration found for this user' });
    }
    
    let purchases;
    
    if (!MOCK_PROKIP) {
      // Use prokipService for real API
      const { startDate, endDate } = req.query;
      console.log('📊 Fetching purchases with params:', { 
        startDate, 
        endDate, 
        locationId: prokipConfig.locationId 
      });
      
      // Get purchases from real Prokip API using improved service function
      purchases = await prokipService.getPurchases(
        prokipConfig.locationId, 
        startDate, 
        endDate, 
        userId
      );
      console.log('📦 Purchases loaded from real API:', purchases.length);
    } else {
      // Use mock API
      const headers = await getHeaders(userId);
      let url = PROKIP_BASE + 'purchase?per_page=-1';
      if (prokipConfig.locationId) {
        url += `&location_id=${prokipConfig.locationId}`;
      }
      
      const response = await axios.get(url, { headers });
      purchases = response.data.data || [];
    }
    
    // Add location information to each purchase
    purchases = purchases.map(purchase => ({
      ...purchase,
      locationId: prokipConfig.locationId,
      userId: userId
    }));
    
    res.json({ 
      success: true, 
      purchases,
      locationId: prokipConfig.locationId,
      userId: userId
    });
  } catch (error) {
    console.error('Failed to fetch purchases:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ 
      error: 'Could not load purchases from Prokip',
      details: error.message 
    });
  }
});

module.exports = router;
