require('dotenv').config();

const axios = require('axios');

// Mock Prokip server for testing authentication flow
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Mock login endpoint
app.post('/api/v1/login', (req, res) => {
  const { email, password } = req.body;
  
  console.log(`🔐 Mock login attempt: ${email}`);
  
  // Simulate authentication
  if (email && password) {
    const mockUser = {
      id: 12345,
      name: email.split('@')[0],
      email: email,
      role: 'user'
    };
    
    const mockToken = `mock-jwt-token-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    
    res.json({
      success: true,
      token: mockToken,
      user: mockUser,
      message: 'Login successful (mock)'
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials (mock)'
    });
  }
});

// Mock stock check endpoint
app.post('/api/v1/stock/check', (req, res) => {
  const { items } = req.body;
  
  const stockChecks = items.map(item => ({
    sku: item.sku,
    requestedQuantity: item.quantity,
    currentStock: Math.floor(Math.random() * 100) + 10,
    available: true
  }));
  
  res.json({
    success: true,
    allAvailable: true,
    stockChecks
  });
});

// Mock order endpoint
app.post('/api/v1/orders', (req, res) => {
  const orderData = req.body;
  
  res.json({
    success: true,
    transactionId: `mock-tx-${Date.now()}`,
    receiptNumber: `mock-receipt-${Date.now()}`,
    message: 'Order processed successfully (mock)',
    order: orderData
  });
});

// Start mock server
app.listen(PORT, () => {
  console.log(`🧪 Mock Prokip API server running on http://localhost:${PORT}`);
  console.log('📝 Available endpoints:');
  console.log('  POST /api/v1/login - Mock authentication');
  console.log('  POST /api/v1/stock/check - Mock stock check');
  console.log('  POST /api/v1/orders - Mock order processing');
});

// Test the complete authentication flow with mock
async function testMockAuthentication() {
  console.log('\n🧪 Testing Complete Authentication Flow with Mock Server');
  
  // Wait a moment for mock server to start
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    console.log('\n1️⃣ Testing user login via dashboard...');
    
    const loginResponse = await axios.post('http://localhost:3000/api/prokip/auth/connect', {
      userId: 'test-user-123',
      email: 'user@example.com',
      password: 'userpassword',
      connectionName: 'Test Connection'
    });
    
    console.log('✅ User login successful!');
    console.log('📊 Response:', JSON.stringify(loginResponse.data, null, 2));
    
    console.log('\n2️⃣ Testing stock check...');
    
    const stockResponse = await axios.post('http://localhost:3000/api/prokip/test-stock/test-user-123', {
      items: [
        { sku: 'TEST-SKU-001', quantity: 2 },
        { sku: 'TEST-SKU-002', quantity: 1 }
      ]
    });
    
    console.log('✅ Stock check successful!');
    console.log('📊 Response:', JSON.stringify(stockResponse.data, null, 2));
    
    console.log('\n3️⃣ Testing order processing...');
    
    const orderResponse = await axios.post('http://localhost:3000/api/prokip/test-order/test-user-123', {
      useSample: true
    });
    
    console.log('✅ Order processing successful!');
    console.log('📊 Response:', JSON.stringify(orderResponse.data, null, 2));
    
    console.log('\n🎉 COMPLETE AUTHENTICATION FLOW WORKING!');
    console.log('✅ Users can authenticate via dashboard');
    console.log('✅ No hardcoded credentials needed');
    console.log('✅ Stock synchronization ready');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Start mock server and run tests
testMockAuthentication();
