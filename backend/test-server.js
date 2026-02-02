require('dotenv').config();

const express = require('express');
const cors = require('cors');
const ProkipUserAuthService = require('./src/services/prokipUserAuthService');

// Create a simple test server to bypass all middleware
const app = express();
app.use(cors());
app.use(express.json());

// Simple test endpoint
app.post('/test-auth', async (req, res) => {
  console.log('🧪 Test auth endpoint called');
  console.log('📊 Request body:', req.body);
  
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password required'
      });
    }
    
    console.log('🔐 Testing with:', username);
    
    const authService = new ProkipUserAuthService();
    const result = await authService.authenticateUser(
      'test-user-123',
      username,
      password,
      'Test Connection'
    );
    
    console.log('📊 Service result:', result);
    console.log('📊 Result.success:', result.success);
    
    if (result.success) {
      console.log('✅ Authentication successful');
      return res.json({
        success: true,
        data: result.data
      });
    } else {
      console.log('❌ Authentication failed');
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return res.status(401).json({
      error: 'Invalid credentials'
    });
  }
});

// Health check
app.get('/test-health', (req, res) => {
  res.json({ status: 'ok', message: 'Test server running' });
});

// Start test server on different port
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🧪 Test server running on port ${PORT}`);
  console.log(`🧪 Test endpoints:`);
  console.log(`   POST http://localhost:${PORT}/test-auth`);
  console.log(`   GET  http://localhost:${PORT}/test-health`);
});

// Test the endpoint
async function testEndpoint() {
  console.log('\n🧪 Testing the test endpoint...');
  
  try {
    const response = await fetch(`http://localhost:${PORT}/test-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'kenditrades',
        password: 'testpassword'
      })
    });
    
    const data = await response.json();
    console.log('📊 Status:', response.status);
    console.log('📊 Data:', data);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Wait a bit then test
setTimeout(testEndpoint, 1000);
