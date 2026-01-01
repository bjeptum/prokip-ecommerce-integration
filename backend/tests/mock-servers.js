const express = require('express');
const crypto = require('crypto');

// ===================================
// MOCK PROKIP API SERVER
// ===================================
function createMockProkipAPI(port = 4000) {
  const app = express();
  app.use(express.json());

  // Sample product data
  const mockProducts = [
    {
      id: 1,
      name: "Wireless Mouse",
      sku: "WM-001",
      type: "single",
      enable_stock: 1,
      product_variations: [{
        id: 1,
        variations: [{
          id: 1,
          sub_sku: "WM-001",
          default_sell_price: "25.00",
          sell_price_inc_tax: "27.50",
          variation_location_details: [{ qty_available: "50.0000" }]
        }]
      }],
      unit: { actual_name: "Pieces", short_name: "Pc(s)" }
    },
    {
      id: 2,
      name: "USB Cable - Type C",
      sku: "USB-TC-001",
      type: "single",
      enable_stock: 1,
      product_variations: [{
        id: 2,
        variations: [{
          id: 2,
          sub_sku: "USB-TC-001",
          default_sell_price: "10.00",
          sell_price_inc_tax: "11.00",
          variation_location_details: [{ qty_available: "150.0000" }]
        }]
      }],
      unit: { actual_name: "Pieces", short_name: "Pc(s)" }
    },
    {
      id: 3,
      name: "Bluetooth Headphones",
      sku: "BT-HP-001",
      type: "single",
      enable_stock: 1,
      product_variations: [{
        id: 3,
        variations: [{
          id: 3,
          sub_sku: "BT-HP-001",
          default_sell_price: "75.00",
          sell_price_inc_tax: "82.50",
          variation_location_details: [{ qty_available: "30.0000" }]
        }]
      }],
      unit: { actual_name: "Pieces", short_name: "Pc(s)" }
    }
  ];

  // Auth middleware
  app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthenticated.' });
    }
    next();
  });

  // GET /connector/api/product - List products
  app.get('/connector/api/product', (req, res) => {
    const { per_page = 10, sku, name } = req.query;
    let products = [...mockProducts];

    if (sku) {
      products = products.filter(p => p.sku.includes(sku));
    }
    if (name) {
      products = products.filter(p => p.name.toLowerCase().includes(name.toLowerCase()));
    }

    res.json({
      data: products,
      meta: { current_page: 1, per_page: parseInt(per_page), total: products.length }
    });
  });

  // GET /connector/api/product/{id} - Get specific product
  app.get('/connector/api/product/:id', (req, res) => {
    const product = mockProducts.find(p => p.id == req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ data: [product] });
  });

  // GET /connector/api/product-stock-report - Stock report
  app.get('/connector/api/product-stock-report', (req, res) => {
    const stockData = mockProducts.map(p => ({
      product_id: p.id,
      sku: p.sku,
      product: p.name,
      type: p.type,
      stock: p.product_variations[0].variations[0].variation_location_details[0].qty_available,
      qty_available: p.product_variations[0].variations[0].variation_location_details[0].qty_available,
      unit_price: p.product_variations[0].variations[0].sell_price_inc_tax,
      variation_id: p.product_variations[0].variations[0].id
    }));

    res.json({
      data: stockData,
      meta: { current_page: 1, per_page: 10, total: stockData.length }
    });
  });

  // POST /connector/api/sell - Create sale
  app.post('/connector/api/sell', (req, res) => {
    const { sells } = req.body;
    if (!sells || !Array.isArray(sells) || sells.length === 0) {
      return res.status(400).json({ error: 'Invalid sell data' });
    }

    const createdSells = sells.map((sell, idx) => ({
      id: 100 + idx,
      invoice_no: `INV${Date.now()}${idx}`,
      contact_id: sell.contact_id,
      transaction_date: sell.transaction_date || new Date().toISOString(),
      final_total: sell.products.reduce((sum, p) => sum + (p.unit_price * p.quantity), 0),
      payment_status: 'paid',
      status: sell.status || 'final',
      sell_lines: sell.products.map(p => ({
        product_id: p.product_id,
        variation_id: p.variation_id,
        quantity: p.quantity,
        unit_price: p.unit_price
      }))
    }));

    res.json({ data: createdSells });
  });

  // POST /connector/api/sell-return - Create return
  app.post('/connector/api/sell-return', (req, res) => {
    const { transaction_id, products } = req.body;
    if (!transaction_id || !products) {
      return res.status(400).json({ error: 'Invalid return data' });
    }

    res.json({
      id: 200 + Math.floor(Math.random() * 100),
      invoice_no: `CN${Date.now()}`,
      return_parent_id: transaction_id,
      final_total: products.reduce((sum, p) => sum + (p.unit_price_inc_tax * p.quantity), 0),
      type: 'sell_return',
      status: 'final'
    });
  });

  app.listen(port, () => {
    console.log(`Mock Prokip API running on http://localhost:${port}`);
  });

  return app;
}

// ===================================
// MOCK SHOPIFY API SERVER
// ===================================
function createMockShopifyAPI(port = 4001) {
  const app = express();
  app.use(express.json());

  const mockShopifyProducts = [
    {
      id: 1001,
      title: "Cool T-Shirt",
      variants: [{
        id: 10011,
        sku: "TSHIRT-001",
        price: "19.99",
        inventory_quantity: 100,
        inventory_item_id: 50001
      }]
    },
    {
      id: 1002,
      title: "Stylish Cap",
      variants: [{
        id: 10021,
        sku: "CAP-001",
        price: "14.99",
        inventory_quantity: 75,
        inventory_item_id: 50002
      }]
    }
  ];

  const mockLocations = [
    { id: 1, name: "Main Warehouse" }
  ];

  // OAuth token exchange
  app.post('/admin/oauth/access_token', (req, res) => {
    const { code, client_id, client_secret } = req.body;
    if (!code) return res.status(400).json({ error: 'Code required' });
    
    res.json({
      access_token: 'mock_shopify_token_' + crypto.randomBytes(16).toString('hex'),
      scope: 'read_products,write_products,read_inventory,write_inventory'
    });
  });

  // GET products
  app.get('/admin/api/:version/products.json', (req, res) => {
    const token = req.headers['x-shopify-access-token'];
    if (!token) return res.status(401).json({ errors: 'Unauthorized' });

    const { sku } = req.query;
    let products = [...mockShopifyProducts];
    
    if (sku) {
      products = products.filter(p => p.variants.some(v => v.sku === sku));
    }

    res.json({ products });
  });

  // POST products
  app.post('/admin/api/:version/products.json', (req, res) => {
    const token = req.headers['x-shopify-access-token'];
    if (!token) return res.status(401).json({ errors: 'Unauthorized' });

    const { product } = req.body;
    const newProduct = {
      id: Date.now(),
      title: product.title,
      variants: product.variants.map((v, idx) => ({
        id: Date.now() + idx,
        sku: v.sku,
        price: v.price,
        inventory_quantity: v.inventory_quantity || 0,
        inventory_item_id: Date.now() + 1000 + idx
      }))
    };

    mockShopifyProducts.push(newProduct);
    res.json({ product: newProduct });
  });

  // GET locations
  app.get('/admin/api/:version/locations.json', (req, res) => {
    const token = req.headers['x-shopify-access-token'];
    if (!token) return res.status(401).json({ errors: 'Unauthorized' });
    
    res.json({ locations: mockLocations });
  });

  // POST inventory levels
  app.post('/admin/api/:version/inventory_levels/set.json', (req, res) => {
    const token = req.headers['x-shopify-access-token'];
    if (!token) return res.status(401).json({ errors: 'Unauthorized' });

    const { location_id, inventory_item_id, available } = req.body;
    res.json({
      inventory_level: {
        location_id,
        inventory_item_id,
        available,
        updated_at: new Date().toISOString()
      }
    });
  });

  // POST webhooks
  app.post('/admin/api/:version/webhooks.json', (req, res) => {
    const token = req.headers['x-shopify-access-token'];
    if (!token) return res.status(401).json({ errors: 'Unauthorized' });

    const { webhook } = req.body;
    res.json({
      webhook: {
        id: Date.now(),
        topic: webhook.topic,
        address: webhook.address,
        format: webhook.format
      }
    });
  });

  app.listen(port, () => {
    console.log(`Mock Shopify API running on http://localhost:${port}`);
  });

  return app;
}

// ===================================
// MOCK WOOCOMMERCE API SERVER
// ===================================
function createMockWooAPI(port = 4002) {
  const app = express();
  app.use(express.json());

  const mockWooProducts = [
    {
      id: 2001,
      name: "Leather Wallet",
      sku: "WALLET-001",
      regular_price: "29.99",
      stock_quantity: 60
    },
    {
      id: 2002,
      name: "Phone Case",
      sku: "CASE-001",
      regular_price: "12.99",
      stock_quantity: 200
    }
  ];

  const mockWooOrders = [
    {
      id: 3001,
      status: "completed",
      date_created: new Date().toISOString(),
      total: "42.98",
      line_items: [
        { product_id: 2001, quantity: 1, total: "29.99" }
      ]
    }
  ];

  // Auth middleware
  app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) {
      return res.status(401).json({ code: 'rest_not_logged_in', message: 'Unauthorized' });
    }
    next();
  });

  // GET products
  app.get('/wp-json/wc/v3/products', (req, res) => {
    const { sku } = req.query;
    let products = [...mockWooProducts];
    
    if (sku) {
      products = products.filter(p => p.sku === sku);
    }

    res.json(products);
  });

  // POST products
  app.post('/wp-json/wc/v3/products', (req, res) => {
    const newProduct = {
      id: Date.now(),
      name: req.body.name,
      sku: req.body.sku,
      regular_price: req.body.regular_price,
      stock_quantity: req.body.stock_quantity || 0
    };

    mockWooProducts.push(newProduct);
    res.json(newProduct);
  });

  // PUT products
  app.put('/wp-json/wc/v3/products/:id', (req, res) => {
    const product = mockWooProducts.find(p => p.id == req.params.id);
    if (!product) return res.status(404).json({ code: 'woocommerce_rest_product_invalid_id', message: 'Invalid ID.' });

    if (req.body.stock_quantity !== undefined) {
      product.stock_quantity = req.body.stock_quantity;
    }

    res.json(product);
  });

  // GET orders
  app.get('/wp-json/wc/v3/orders', (req, res) => {
    const { status, after } = req.query;
    let orders = [...mockWooOrders];

    if (status) {
      orders = orders.filter(o => o.status === status);
    }

    res.json(orders);
  });

  // POST webhooks
  app.post('/wp-json/wc/v3/webhooks', (req, res) => {
    const webhook = {
      id: Date.now(),
      name: req.body.name,
      topic: req.body.topic,
      delivery_url: req.body.delivery_url,
      status: 'active'
    };

    res.json(webhook);
  });

  app.listen(port, () => {
    console.log(`Mock WooCommerce API running on http://localhost:${port}`);
  });

  return app;
}

// Start all mock servers if run directly
if (require.main === module) {
  console.log('Starting all mock API servers...\n');
  createMockProkipAPI(4000);
  createMockShopifyAPI(4001);
  createMockWooAPI(4002);
  console.log('\n✅ All mock servers are running!');
  console.log('📍 Prokip:      http://localhost:4000');
  console.log('📍 Shopify:     http://localhost:4001');
  console.log('📍 WooCommerce: http://localhost:4002');
}

module.exports = {
  createMockProkipAPI,
  createMockShopifyAPI,
  createMockWooAPI
};
