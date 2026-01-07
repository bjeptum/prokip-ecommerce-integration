/**
 * Mock Prokip API Server for Local Testing
 * 
 * This creates a local API that mimics Prokip's API responses
 * Run this to test your integration locally before connecting to live Prokip API
 * 
 * Usage:
 *   node tests/mock-prokip-api.js
 *   Then point PROKIP_API to http://localhost:4000 in your .env
 */

const express = require('express');
const app = express();
app.use(express.json());

const PORT = 4000;

// Mock database
let mockProducts = [
  {
    id: 1,
    name: 'T-Shirt Blue',
    sku: 'TSHIRT-001',
    product_variations: [
      {
        id: 1,
        variations: [
          {
            id: 1,
            sell_price_inc_tax: 2500,
            default_purchase_price: 1500,
            qty_available: 100
          }
        ]
      }
    ]
  },
  {
    id: 2,
    name: 'Jeans Denim',
    sku: 'JEANS-002',
    product_variations: [
      {
        id: 2,
        variations: [
          {
            id: 2,
            sell_price_inc_tax: 4500,
            default_purchase_price: 3000,
            qty_available: 50
          }
        ]
      }
    ]
  }
];

let mockInventory = [
  { sku: 'TSHIRT-001', quantity: 100, location_id: 'LOC001' },
  { sku: 'JEANS-002', quantity: 50, location_id: 'LOC001' }
];

let mockSales = [];

// Middleware: Verify token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid token' });
  }
  
  const token = authHeader.split(' ')[1];
  if (token !== 'mock_prokip_token_123') {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
  }
  
  next();
};

// Apply auth to all routes
app.use('/connector/api', verifyToken);

// ========================================
// PRODUCT ENDPOINTS
// ========================================

// GET all products
app.get('/connector/api/product', (req, res) => {
  const perPage = req.query.per_page || 10;
  
  res.json({
    success: true,
    data: mockProducts,
    meta: {
      total: mockProducts.length,
      per_page: parseInt(perPage),
      current_page: 1
    }
  });
});

// GET single product
app.get('/connector/api/product/:id', (req, res) => {
  const product = mockProducts.find(p => p.id == req.params.id);
  
  if (!product) {
    return res.status(404).json({
      success: false,
      error: 'Product not found'
    });
  }
  
  res.json({
    success: true,
    data: product
  });
});

// CREATE product
app.post('/connector/api/product', (req, res) => {
  const { name, sku, sell_price, purchase_price, initial_quantity, location_id } = req.body;
  
  if (!name || !sku) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: 'Name and SKU are required'
    });
  }
  
  // Check if SKU already exists
  const existing = mockProducts.find(p => p.sku === sku);
  if (existing) {
    return res.status(409).json({
      success: false,
      error: 'Conflict',
      message: 'Product with this SKU already exists'
    });
  }
  
  const newProduct = {
    id: mockProducts.length + 1,
    name,
    sku,
    product_variations: [
      {
        id: mockProducts.length + 1,
        variations: [
          {
            id: mockProducts.length + 1,
            sell_price_inc_tax: sell_price || 0,
            default_purchase_price: purchase_price || 0,
            qty_available: initial_quantity || 0
          }
        ]
      }
    ]
  };
  
  mockProducts.push(newProduct);
  
  // Add to inventory
  mockInventory.push({
    sku,
    quantity: initial_quantity || 0,
    location_id: location_id || 'LOC001'
  });
  
  res.status(201).json({
    success: true,
    data: newProduct,
    message: 'Product created successfully'
  });
});

// ========================================
// INVENTORY ENDPOINTS
// ========================================

// GET inventory
app.get('/connector/api/inventory', (req, res) => {
  const locationId = req.query.location_id;
  
  let inventory = mockInventory;
  if (locationId) {
    inventory = mockInventory.filter(i => i.location_id === locationId);
  }
  
  res.json({
    success: true,
    data: inventory
  });
});

// UPDATE inventory (for testing stock changes)
app.put('/connector/api/inventory/:sku', (req, res) => {
  const { sku } = req.params;
  const { quantity } = req.body;
  
  const item = mockInventory.find(i => i.sku === sku);
  if (!item) {
    return res.status(404).json({
      success: false,
      error: 'SKU not found'
    });
  }
  
  item.quantity = quantity;
  
  // Also update product quantity
  const product = mockProducts.find(p => p.sku === sku);
  if (product && product.product_variations[0]) {
    product.product_variations[0].variations[0].qty_available = quantity;
  }
  
  res.json({
    success: true,
    data: item,
    message: 'Inventory updated successfully'
  });
});

// CREATE purchase (add inventory)
app.post('/connector/api/purchase', (req, res) => {
  const { location_id, items, supplier_id, transaction_date, reference_no } = req.body;
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: 'Items array is required'
    });
  }
  
  const purchaseId = `PURCHASE-${Date.now()}`;
  
  // Update inventory (add quantities)
  items.forEach(item => {
    const product = mockProducts.find(p => p.id == item.product_id || p.sku === item.sku);
    if (product && product.product_variations[0]) {
      const variation = product.product_variations[0].variations[0];
      variation.qty_available += item.quantity;
      
      // Update inventory too
      const invItem = mockInventory.find(i => i.sku === product.sku);
      if (invItem) {
        invItem.quantity += item.quantity;
      }
    }
  });
  
  const purchase = {
    purchase_id: purchaseId,
    location_id: location_id || 'LOC001',
    supplier_id: supplier_id || 'default-supplier',
    transaction_date: transaction_date || new Date().toISOString(),
    reference_no: reference_no || purchaseId,
    items,
    total_amount: items.reduce((sum, item) => sum + (item.unit_cost * item.quantity), 0),
    status: 'received'
  };
  
  res.status(201).json({
    success: true,
    data: purchase,
    message: 'Purchase created successfully'
  });
});

// GET product stock report
app.get('/connector/api/product-stock-report', (req, res) => {
  const stockReport = mockProducts.map(p => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    stock: p.product_variations[0]?.variations[0]?.qty_available || 0,
    qty_available: p.product_variations[0]?.variations[0]?.qty_available || 0,
    sell_price: p.product_variations[0]?.variations[0]?.sell_price_inc_tax || 0
  }));
  
  res.json(stockReport);
});

// ========================================
// SALES ENDPOINTS
// ========================================

// CREATE sale (existing endpoint - also add /sell for compatibility)
app.post('/connector/api/sell', (req, res) => {
  const { sells } = req.body;
  
  if (!sells || !Array.isArray(sells) || sells.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: 'Sells array is required'
    });
  }
  
  const sell = sells[0]; // Process first sell
  const { location_id, products, invoice_no, final_total } = sell;
  
  // Generate sell ID
  const sellId = Date.now();
  
  // Update inventory (reduce quantities)
  products.forEach(item => {
    const product = mockProducts.find(p => p.id == item.product_id);
    if (product && product.product_variations[0]) {
      const variation = product.product_variations[0].variations[0];
      variation.qty_available -= item.quantity;
      
      // Update inventory too
      const invItem = mockInventory.find(i => i.sku === product.sku);
      if (invItem) {
        invItem.quantity -= item.quantity;
      }
    }
  });
  
  const sale = {
    id: sellId,
    transaction_id: sellId,
    location_id,
    invoice_no,
    final_total,
    products,
    status: 'final'
  };
  
  mockSales.push(sale);
  
  res.status(201).json({
    success: true,
    id: sellId,
    data: sale,
    message: 'Sale created successfully'
  });
});

// CREATE sale (legacy endpoint)
app.post('/connector/api/sells', (req, res) => {
  const { location_id, items, contact_id, transaction_date } = req.body;
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: 'Items array is required'
    });
  }
  
  // Generate mock sale ID
  const sellId = `SELL-${Date.now()}`;
  const transactionId = `TXN-${Date.now()}`;
  
  // Update inventory (reduce quantities)
  items.forEach(item => {
    const product = mockProducts.find(p => p.id == item.product_id);
    if (product && product.product_variations[0]) {
      const variation = product.product_variations[0].variations[0];
      variation.qty_available -= item.quantity;
      
      // Update inventory too
      const invItem = mockInventory.find(i => i.sku === product.sku);
      if (invItem) {
        invItem.quantity -= item.quantity;
      }
    }
  });
  
  const sale = {
    sell_id: sellId,
    transaction_id: transactionId,
    location_id,
    contact_id: contact_id || 'walk-in-customer',
    transaction_date: transaction_date || new Date().toISOString(),
    items,
    total_amount: items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0),
    status: 'completed'
  };
  
  mockSales.push(sale);
  
  res.status(201).json({
    success: true,
    data: sale,
    message: 'Sale created successfully'
  });
});

// GET sale by ID
app.get('/connector/api/sells/:id', (req, res) => {
  const sale = mockSales.find(s => s.sell_id === req.params.id);
  
  if (!sale) {
    return res.status(404).json({
      success: false,
      error: 'Sale not found'
    });
  }
  
  res.json({
    success: true,
    data: sale
  });
});

// REFUND sale
app.post('/connector/api/sells/:id/refund', (req, res) => {
  const sale = mockSales.find(s => s.sell_id === req.params.id);
  
  if (!sale) {
    return res.status(404).json({
      success: false,
      error: 'Sale not found'
    });
  }
  
  const { items } = req.body;
  
  // Restore inventory
  items.forEach(item => {
    const product = mockProducts.find(p => p.id == item.product_id);
    if (product && product.product_variations[0]) {
      const variation = product.product_variations[0].variations[0];
      variation.qty_available += item.quantity;
      
      const invItem = mockInventory.find(i => i.sku === product.sku);
      if (invItem) {
        invItem.quantity += item.quantity;
      }
    }
  });
  
  sale.status = 'refunded';
  
  res.json({
    success: true,
    data: sale,
    message: 'Refund processed successfully'
  });
});

// CREATE sell-return (for webhook refunds)
app.post('/connector/api/sell-return', (req, res) => {
  const { transaction_id, products } = req.body;
  
  // Restore inventory
  products.forEach(item => {
    const product = mockProducts.find(p => p.sku === item.sku);
    if (product && product.product_variations[0]) {
      const variation = product.product_variations[0].variations[0];
      variation.qty_available += item.quantity;
      
      const invItem = mockInventory.find(i => i.sku === product.sku);
      if (invItem) {
        invItem.quantity += item.quantity;
      }
    }
  });
  
  res.json({
    success: true,
    message: 'Sell return processed successfully',
    transaction_id
  });
});

// ========================================
// HEALTH CHECK
// ========================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Mock Prokip API is running',
    endpoints: {
      products: 'GET /connector/api/product',
      createProduct: 'POST /connector/api/product',
      inventory: 'GET /connector/api/inventory',
      stockReport: 'GET /connector/api/product-stock-report',
      createSale: 'POST /connector/api/sell',
      createPurchase: 'POST /connector/api/purchase',
      sellReturn: 'POST /connector/api/sell-return',
      refund: 'POST /connector/api/sells/:id/refund'
    },
    note: 'Use token: mock_prokip_token_123'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║        MOCK PROKIP API SERVER RUNNING                  ║
╚════════════════════════════════════════════════════════╝

📍 URL: http://localhost:${PORT}
🔑 Token: mock_prokip_token_123

📚 Available Endpoints:
   GET  /health
   GET  /connector/api/product
   POST /connector/api/product              (NEW)
   GET  /connector/api/product/:id
   GET  /connector/api/inventory
   GET  /connector/api/product-stock-report (NEW)
   POST /connector/api/sell                 (NEW)
   POST /connector/api/sells
   POST /connector/api/sell-return          (NEW)
   POST /connector/api/purchase             (NEW)
   GET  /connector/api/sells/:id
   POST /connector/api/sells/:id/refund

💡 Usage in .env:
   PROKIP_API=http://localhost:${PORT}
   PROKIP_TOKEN=mock_prokip_token_123
   PROKIP_LOCATION=LOC001

🧪 Test commands:
   curl http://localhost:${PORT}/health
   
   curl -H "Authorization: Bearer mock_prokip_token_123" \\
        http://localhost:${PORT}/connector/api/product

Press Ctrl+C to stop
  `);
});
