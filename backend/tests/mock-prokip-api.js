/**
 * Mock Prokip API Server for Local Testing
 * 
 * ENHANCED VERSION with Persistent Storage
 * - Full CRUD operations for products, sales, purchases
 * - In-memory database with JSON file persistence
 * - All operations are saved and survive server restarts
 * 
 * Usage:
 *   node tests/mock-prokip-api.js
 *   Then set: PROKIP_API=http://localhost:4000 in your .env
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(express.json());

const PORT = 4000;
const DATA_FILE = path.join(__dirname, 'mock-prokip-data.json');

// ========================================
// PERSISTENT STORAGE
// ========================================

let database = {
  products: [],
  sales: [],
  purchases: [],
  sellReturns: [],
  nextProductId: 1,
  nextSaleId: 1,
  nextPurchaseId: 1
};

// Load data from file on startup
function loadDatabase() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      database = JSON.parse(data);
      console.log('✅ Loaded database from file:', DATA_FILE);
      console.log('   Products: ' + database.products.length);
      console.log('   Sales: ' + database.sales.length);
      console.log('   Purchases: ' + database.purchases.length);
    } else {
      console.log('📝 No existing database file, starting fresh');
      saveDatabase();
    }
  } catch (error) {
    console.error('⚠️  Error loading database:', error.message);
    console.log('   Starting with empty database');
  }
}

// Save data to file
function saveDatabase() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(database, null, 2));
  } catch (error) {
    console.error('❌ Error saving database:', error.message);
  }
}

// Auto-save every 30 seconds
setInterval(saveDatabase, 30000);

// Save on exit
process.on('SIGINT', () => {
  console.log('\\n💾 Saving database...');
  saveDatabase();
  console.log('✅ Database saved. Goodbye!');
  process.exit(0);
});

// Initialize database
loadDatabase();

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
  const sku = req.query.sku;
  
  let products = database.products;
  
  // Filter by SKU if provided
  if (sku) {
    products = products.filter(p => p.sku === sku);
  }
  
  res.json({
    success: true,
    data: products,
    meta: {
      total: products.length,
      per_page: parseInt(perPage),
      current_page: 1
    }
  });
});

// GET single product
app.get('/connector/api/product/:id', (req, res) => {
  const product = database.products.find(p => p.id == req.params.id);
  
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
  const existing = database.products.find(p => p.sku === sku);
  if (existing) {
    return res.status(409).json({
      success: false,
      error: 'Conflict',
      message: 'Product with this SKU already exists'
    });
  }
  
  const productId = database.nextProductId++;
  const newProduct = {
    id: productId,
    name,
    sku,
    location_id: location_id || 'LOC001',
    created_at: new Date().toISOString(),
    product_variations: [
      {
        id: productId,
        variations: [
          {
            id: productId,
            sell_price_inc_tax: parseFloat(sell_price) || 0,
            default_purchase_price: parseFloat(purchase_price) || 0,
            qty_available: parseInt(initial_quantity) || 0
          }
        ]
      }
    ]
  };
  
  database.products.push(newProduct);
  saveDatabase();
  
  console.log('✅ Created product: ' + name + ' (SKU: ' + sku + ')');
  
  res.status(201).json({
    success: true,
    data: newProduct,
    message: 'Product created successfully'
  });
});

// UPDATE product
app.put('/connector/api/product/:id', (req, res) => {
  const productId = parseInt(req.params.id);
  const productIndex = database.products.findIndex(p => p.id === productId);
  
  if (productIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Product not found'
    });
  }
  
  const { name, sell_price, purchase_price, quantity } = req.body;
  const product = database.products[productIndex];
  
  if (name) product.name = name;
  if (sell_price) product.product_variations[0].variations[0].sell_price_inc_tax = parseFloat(sell_price);
  if (purchase_price) product.product_variations[0].variations[0].default_purchase_price = parseFloat(purchase_price);
  if (quantity !== undefined) product.product_variations[0].variations[0].qty_available = parseInt(quantity);
  
  product.updated_at = new Date().toISOString();
  saveDatabase();
  
  console.log('📝 Updated product: ' + product.name + ' (ID: ' + productId + ')');
  
  res.json({
    success: true,
    data: product,
    message: 'Product updated successfully'
  });
});

// DELETE product
app.delete('/connector/api/product/:id', (req, res) => {
  const productId = parseInt(req.params.id);
  const productIndex = database.products.findIndex(p => p.id === productId);
  
  if (productIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Product not found'
    });
  }
  
  const deletedProduct = database.products.splice(productIndex, 1)[0];
  saveDatabase();
  
  console.log('🗑️  Deleted product: ' + deletedProduct.name + ' (SKU: ' + deletedProduct.sku + ')');
  
  res.json({
    success: true,
    message: 'Product deleted successfully'
  });
});

// ========================================
// INVENTORY ENDPOINTS
// ========================================

// GET product stock report
app.get('/connector/api/product-stock-report', (req, res) => {
  const stockReport = database.products.map(p => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    stock: p.product_variations[0]?.variations[0]?.qty_available || 0,
    qty_available: p.product_variations[0]?.variations[0]?.qty_available || 0,
    sell_price: p.product_variations[0]?.variations[0]?.sell_price_inc_tax || 0
  }));
  
  res.json(stockReport);
});

// UPDATE inventory directly
app.put('/connector/api/inventory/:sku', (req, res) => {
  const { sku } = req.params;
  const { quantity } = req.body;
  
  const product = database.products.find(p => p.sku === sku);
  if (!product) {
    return res.status(404).json({
      success: false,
      error: 'SKU not found'
    });
  }
  
  product.product_variations[0].variations[0].qty_available = parseInt(quantity);
  saveDatabase();
  
  console.log('📦 Updated inventory for ' + sku + ': ' + quantity + ' units');
  
  res.json({
    success: true,
    message: 'Inventory updated successfully',
    data: {
      sku,
      quantity: parseInt(quantity)
    }
  });
});

// ========================================
// SALES ENDPOINTS
// ========================================

// CREATE sale (Prokip format with sells array)
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
  const { location_id, products, invoice_no, final_total, contact_id } = sell;
  
  // Generate sell ID
  const sellId = database.nextSaleId++;
  
  // Update inventory (reduce quantities)
  products.forEach(item => {
    const product = database.products.find(p => p.id == item.product_id);
    if (product && product.product_variations[0]) {
      const variation = product.product_variations[0].variations[0];
      variation.qty_available = Math.max(0, variation.qty_available - item.quantity);
    }
  });
  
  const sale = {
    id: sellId,
    transaction_id: sellId,
    location_id: location_id || 'LOC001',
    contact_id: contact_id || 1,
    invoice_no: invoice_no || 'INV-' + sellId,
    final_total: final_total || 0,
    products,
    status: 'final',
    created_at: new Date().toISOString()
  };
  
  database.sales.push(sale);
  saveDatabase();
  
  console.log('💰 Sale recorded: Invoice ' + sale.invoice_no + ' - Total: ' + final_total);
  
  res.status(201).json({
    success: true,
    id: sellId,
    data: sale,
    message: 'Sale created successfully'
  });
});

// GET all sales
app.get('/connector/api/sell', (req, res) => {
  res.json({
    success: true,
    data: database.sales
  });
});

// GET sale by ID
app.get('/connector/api/sell/:id', (req, res) => {
  const sale = database.sales.find(s => s.id == req.params.id || s.transaction_id == req.params.id);
  
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

// CREATE sell-return (for refunds)
app.post('/connector/api/sell-return', (req, res) => {
  const { transaction_id, products, discount_amount, discount_type } = req.body;
  
  if (!products || products.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Products array is required'
    });
  }
  
  // Restore inventory for each product
  products.forEach(item => {
    const product = database.products.find(p => p.sku === item.sku);
    if (product && product.product_variations[0]) {
      const variation = product.product_variations[0].variations[0];
      variation.qty_available += parseInt(item.quantity);
    }
  });
  
  const sellReturn = {
    id: database.sellReturns.length + 1,
    transaction_id,
    products,
    discount_amount: discount_amount || 0,
    discount_type: discount_type || 'fixed',
    created_at: new Date().toISOString()
  };
  
  database.sellReturns.push(sellReturn);
  saveDatabase();
  
  console.log('↩️  Sell return processed for transaction ' + transaction_id);
  
  res.json({
    success: true,
    message: 'Sell return processed successfully',
    data: sellReturn
  });
});

// ========================================
// PURCHASE ENDPOINTS
// ========================================

// CREATE purchase
app.post('/connector/api/purchase', (req, res) => {
  const { purchases } = req.body;
  
  if (!purchases || !Array.isArray(purchases) || purchases.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: 'Purchases array is required'
    });
  }
  
  const purchase = purchases[0]; // Process first purchase
  const { location_id, contact_id, products, total_amount } = purchase;
  
  const purchaseId = database.nextPurchaseId++;
  
  // Update inventory (add quantities)
  products.forEach(item => {
    const product = database.products.find(p => p.id == item.product_id);
    if (product && product.product_variations[0]) {
      const variation = product.product_variations[0].variations[0];
      variation.qty_available += parseInt(item.quantity);
    }
  });
  
  const newPurchase = {
    id: purchaseId,
    transaction_id: purchaseId,
    location_id: location_id || 'LOC001',
    contact_id: contact_id || 1,
    products,
    total_amount: total_amount || 0,
    status: 'received',
    created_at: new Date().toISOString()
  };
  
  database.purchases.push(newPurchase);
  saveDatabase();
  
  console.log('📥 Purchase recorded: ' + products.length + ' items - Total: ' + total_amount);
  
  res.status(201).json({
    success: true,
    id: purchaseId,
    data: newPurchase,
    message: 'Purchase created successfully'
  });
});

// GET all purchases
app.get('/connector/api/purchase', (req, res) => {
  res.json({
    success: true,
    data: database.purchases
  });
});

// GET purchase by ID
app.get('/connector/api/purchase/:id', (req, res) => {
  const purchase = database.purchases.find(p => p.id == req.params.id);
  
  if (!purchase) {
    return res.status(404).json({
      success: false,
      error: 'Purchase not found'
    });
  }
  
  res.json({
    success: true,
    data: purchase
  });
});

// ========================================
// UTILITY ENDPOINTS
// ========================================

// Reset database (for testing)
app.post('/connector/api/reset-database', (req, res) => {
  database = {
    products: [],
    sales: [],
    purchases: [],
    sellReturns: [],
    nextProductId: 1,
    nextSaleId: 1,
    nextPurchaseId: 1
  };
  saveDatabase();
  
  console.log('🔄 Database reset');
  
  res.json({
    success: true,
    message: 'Database reset successfully'
  });
});

// Get database stats
app.get('/connector/api/stats', (req, res) => {
  const totalStock = database.products.reduce((sum, p) => {
    return sum + (p.product_variations[0]?.variations[0]?.qty_available || 0);
  }, 0);
  
  const totalSalesValue = database.sales.reduce((sum, s) => sum + (s.final_total || 0), 0);
  const totalPurchaseValue = database.purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  
  res.json({
    success: true,
    data: {
      products: database.products.length,
      sales: database.sales.length,
      purchases: database.purchases.length,
      sellReturns: database.sellReturns.length,
      totalStock,
      totalSalesValue,
      totalPurchaseValue,
      dataFile: DATA_FILE
    }
  });
});

// ========================================
// HEALTH CHECK
// ========================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Mock Prokip API is running',
    database: {
      products: database.products.length,
      sales: database.sales.length,
      purchases: database.purchases.length,
      dataFile: DATA_FILE
    },
    endpoints: {
      products: 'GET /connector/api/product',
      createProduct: 'POST /connector/api/product',
      updateProduct: 'PUT /connector/api/product/:id',
      deleteProduct: 'DELETE /connector/api/product/:id',
      stockReport: 'GET /connector/api/product-stock-report',
      updateInventory: 'PUT /connector/api/inventory/:sku',
      createSale: 'POST /connector/api/sell',
      getSales: 'GET /connector/api/sell',
      sellReturn: 'POST /connector/api/sell-return',
      createPurchase: 'POST /connector/api/purchase',
      getPurchases: 'GET /connector/api/purchase',
      stats: 'GET /connector/api/stats',
      resetDatabase: 'POST /connector/api/reset-database'
    },
    note: 'Use token: mock_prokip_token_123'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     MOCK PROKIP API SERVER - PERSISTENT VERSION          ║
╚═══════════════════════════════════════════════════════════╝

📍 URL: http://localhost:` + PORT + `
🔑 Token: mock_prokip_token_123
💾 Database: ` + DATA_FILE + `

📊 Current Data:
   Products: ` + database.products.length + `
   Sales: ` + database.sales.length + `
   Purchases: ` + database.purchases.length + `

📚 Product Endpoints:
   GET    /connector/api/product
   POST   /connector/api/product
   GET    /connector/api/product/:id
   PUT    /connector/api/product/:id
   DELETE /connector/api/product/:id

📦 Inventory Endpoints:
   GET  /connector/api/product-stock-report
   PUT  /connector/api/inventory/:sku

💰 Sales Endpoints:
   POST /connector/api/sell
   GET  /connector/api/sell
   GET  /connector/api/sell/:id
   POST /connector/api/sell-return

🛒 Purchase Endpoints:
   POST /connector/api/purchase
   GET  /connector/api/purchase
   GET  /connector/api/purchase/:id

🔧 Utility Endpoints:
   GET  /health
   GET  /connector/api/stats
   POST /connector/api/reset-database

💡 Usage in .env:
   MOCK_PROKIP=true
   PROKIP_API=http://localhost:` + PORT + `
   
⚠️  In ProkipConfig table, set:
   token: mock_prokip_token_123
   apiUrl: http://localhost:` + PORT + `
   locationId: LOC001

✨ Features:
   ✅ Full CRUD operations
   ✅ Persistent storage (survives restart)
   ✅ Auto-save every 30 seconds
   ✅ Real inventory tracking
   ✅ Sales & purchase history

🧪 Quick Test:
   curl http://localhost:` + PORT + `/health
   curl http://localhost:` + PORT + `/connector/api/stats

Press Ctrl+C to stop (will auto-save)
  `);
});
