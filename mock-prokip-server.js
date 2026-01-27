const express = require('express');

const app = express();
app.use(express.json());

// Enable CORS for all origins
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Mock product data
const mockProducts = [
  {
    id: '4744942',
    name: 'Sample Product 1',
    sku: '4744942',
    product_variations: [{
      variations: [{
        sell_price_inc_tax: 29.99
      }]
    }]
  },
  {
    id: '4815445',
    name: 'Sample Product 2', 
    sku: '4815445',
    product_variations: [{
      variations: [{
        sell_price_inc_tax: 49.99
      }]
    }]
  },
  {
    id: '4848961',
    name: 'Sample Product 3',
    sku: '4848961', 
    product_variations: [{
      variations: [{
        sell_price_inc_tax: 19.99
      }]
    }]
  }
];

// Mock products endpoint
app.get('/connector/api/product', (req, res) => {
  console.log('Mock Prokip: GET /connector/api/product');
  res.json({
    data: mockProducts,
    total: mockProducts.length
  });
});

// Mock stock report endpoint
app.get('/connector/api/product-stock-report', (req, res) => {
  console.log('Mock Prokip: GET /connector/api/product-stock-report');
  const stockData = mockProducts.map(p => ({
    ...p,
    stock: Math.floor(Math.random() * 100) + 1,
    qty_available: Math.floor(Math.random() * 100) + 1
  }));
  
  res.json({
    data: stockData,
    total: stockData.length
  });
});

const PORT = 4000;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`🔧 Mock Prokip server running on http://127.0.0.1:${PORT}`);
  console.log('📦 Mock products available');
});
