const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Add this to parse form data

// Mock data
const mockUsers = {
  'kenditrades': {
    id: 1,
    username: 'kenditrades',
    email: 'kenditrades@example.com',
    locations: [
      {
        id: '1',
        name: 'Main Store',
        address: '123 Main St, Nairobi, Kenya',
        phone: '+254 712 345 678',
        email: 'main@kenditrades.com'
      },
      {
        id: '2', 
        name: 'Branch Store',
        address: '456 Branch Ave, Mombasa, Kenya',
        phone: '+254 734 567 890',
        email: 'branch@kenditrades.com'
      }
    ],
    products: [
      {
        id: '1',
        name: 'Laptop Dell XPS 13',
        sku: 'DELL-XPS13-001',
        price: 85000,
        cost: 65000,
        quantity: 15,
        category: 'Electronics',
        image: 'https://via.placeholder.com/150x150?text=Laptop',
        description: 'High-performance laptop with 13-inch display'
      },
      {
        id: '2',
        name: 'Office Chair Ergonomic',
        sku: 'CHAIR-ERGO-002',
        price: 12500,
        cost: 8500,
        quantity: 25,
        category: 'Furniture',
        image: 'https://via.placeholder.com/150x150?text=Chair',
        description: 'Comfortable ergonomic office chair'
      },
      {
        id: '3',
        name: 'Wireless Mouse',
        sku: 'MOUSE-WIFI-003',
        price: 2500,
        cost: 1500,
        quantity: 50,
        category: 'Electronics',
        image: 'https://via.placeholder.com/150x150?text=Mouse',
        description: 'Wireless optical mouse'
      },
      {
        id: '4',
        name: 'Standing Desk',
        sku: 'DESK-STAND-004',
        price: 35000,
        cost: 25000,
        quantity: 8,
        category: 'Furniture',
        image: 'https://via.placeholder.com/150x150?text=Desk',
        description: 'Adjustable height standing desk'
      },
      {
        id: '5',
        name: 'USB-C Hub',
        sku: 'HUB-USBC-005',
        price: 4500,
        cost: 3000,
        quantity: 30,
        category: 'Electronics',
        image: 'https://via.placeholder.com/150x150?text=Hub',
        description: 'Multi-port USB-C hub'
      }
    ]
  }
};

// Mock OAuth token endpoint
app.post('/oauth/token', (req, res) => {
  const { username, password, client_id, client_secret, grant_type } = req.body;
  
  console.log('🔐 Mock Prokip Login Request:', { username, client_id, grant_type });
  
  // Simulate authentication
  if (mockUsers[username] && password === 'Myifrit37942949#') {
    const tokenData = {
      access_token: `mock_token_${Date.now()}_${username}`,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: `mock_refresh_${Date.now()}_${username}`,
      scope: 'read write'
    };
    
    console.log('✅ Mock Prokip Login Successful');
    res.json(tokenData);
  } else {
    console.log('❌ Mock Prokip Login Failed');
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Mock business locations endpoint
app.get('/connector/api/business-location', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Extract username from token (mock logic)
  const token = authHeader.split(' ')[1];
  const username = token.includes('kenditrades') ? 'kenditrades' : 'unknown';
  
  if (mockUsers[username]) {
    res.json({
      success: true,
      data: mockUsers[username].locations
    });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// Mock products endpoint
app.get('/connector/api/product', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Extract username from token (mock logic)
  const token = authHeader.split(' ')[1];
  const username = token.includes('kenditrades') ? 'kenditrades' : 'unknown';
  
  if (mockUsers[username]) {
    res.json({
      success: true,
      data: mockUsers[username].products
    });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// Mock sales endpoint
app.get('/connector/api/sell', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Mock sales data with prefixes
  const mockSales = [
    {
      id: '1',
      invoice_no: 'PROKIP-001',
      transaction_date: '2026-01-10 14:30:00',
      total: 85000,
      status: 'final',
      payment_status: 'paid',
      platform: 'Prokip',
      products: [
        { sku: 'DELL-XPS13-001', name: 'Laptop Dell XPS 13', quantity: 1, price: 85000 }
      ]
    },
    {
      id: '2', 
      invoice_no: 'WOO-001',
      transaction_date: '2026-01-10 15:45:00',
      total: 15000,
      status: 'final',
      payment_status: 'paid',
      platform: 'WooCommerce',
      products: [
        { sku: 'CHAIR-ERGO-002', name: 'Office Chair Ergonomic', quantity: 1, price: 12500 },
        { sku: 'MOUSE-WIFI-003', name: 'Wireless Mouse', quantity: 1, price: 2500 }
      ]
    },
    {
      id: '3',
      invoice_no: 'SHOPIFY-001',
      transaction_date: '2026-01-10 16:20:00',
      total: 39500,
      status: 'final',
      payment_status: 'paid',
      platform: 'Shopify',
      products: [
        { sku: 'DESK-STAND-004', name: 'Standing Desk', quantity: 1, price: 35000 },
        { sku: 'HUB-USBC-005', name: 'USB-C Hub', quantity: 1, price: 4500 }
      ]
    }
  ];
  
  res.json({
    success: true,
    data: mockSales
  });
});

// Mock analytics endpoint
app.get('/connector/api/analytics', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Mock analytics data
  const mockAnalytics = {
    total_sales: 139500,
    total_orders: 3,
    total_products: 5,
    low_stock_items: 1,
    top_selling_products: [
      { sku: 'DELL-XPS13-001', name: 'Laptop Dell XPS 13', quantity_sold: 1, revenue: 85000 },
      { sku: 'DESK-STAND-004', name: 'Standing Desk', quantity_sold: 1, revenue: 35000 },
      { sku: 'CHAIR-ERGO-002', name: 'Office Chair Ergonomic', quantity_sold: 1, revenue: 12500 }
    ],
    sales_by_platform: {
      'Prokip': { orders: 1, revenue: 85000 },
      'WooCommerce': { orders: 1, revenue: 15000 },
      'Shopify': { orders: 1, revenue: 39500 }
    },
    recent_sales: [
      {
        invoice_no: 'SHOPIFY-001',
        platform: 'Shopify',
        total: 39500,
        date: '2026-01-10 16:20:00'
      },
      {
        invoice_no: 'WOO-001',
        platform: 'WooCommerce', 
        total: 15000,
        date: '2026-01-10 15:45:00'
      },
      {
        invoice_no: 'PROKIP-001',
        platform: 'Prokip',
        total: 85000,
        date: '2026-01-10 14:30:00'
      }
    ]
  };
  
  res.json({
    success: true,
    data: mockAnalytics
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Mock Prokip API is running', timestamp: new Date().toISOString() });
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`🚀 Mock Prokip API running on http://localhost:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   POST /oauth/token - Authentication`);
  console.log(`   GET /connector/api/business-location - Business locations`);
  console.log(`   GET /connector/api/product - Products`);
  console.log(`   GET /connector/api/sell - Sales`);
  console.log(`   GET /connector/api/analytics - Analytics`);
  console.log(`   GET /health - Health check`);
});
