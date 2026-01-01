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
  
  res.json({
    success: true,
    data: item,
    message: 'Inventory updated successfully'
  });
});

// ========================================
// SALES ENDPOINTS
// ========================================

// CREATE sale
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

// ========================================
// HEALTH CHECK
// ========================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Mock Prokip API is running',
    endpoints: {
      products: 'GET /connector/api/product',
      inventory: 'GET /connector/api/inventory',
      createSale: 'POST /connector/api/sells',
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
   GET  /connector/api/product/:id
   GET  /connector/api/inventory
   POST /connector/api/sells
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
