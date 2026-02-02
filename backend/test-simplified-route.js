// Test simplified version of the problematic route
const express = require('express');
const { body, validationResult } = require('express-validator');
const ProkipUserAuthService = require('./src/services/prokipUserAuthService');

console.log('🧪 Testing simplified route...');

const router = express.Router();
const authService = new ProkipUserAuthService();

// Simplified version of the connect route without validation
router.post('/auth/connect', async (req, res) => {
  try {
    console.log('🎯 Simplified route hit!', req.body);
    
    const { userId, email, password, connectionName } = req.body;

    if (!userId || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Authenticate user with Prokip
    const result = await authService.authenticateUser(userId, email, password, connectionName);

    res.json({
      success: true,
      message: 'Prokip account connected successfully',
      data: result
    });

  } catch (error) {
    console.error('❌ Route error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
});

// Test the simplified route
const app = express();
app.use(express.json());
app.use('/api/prokip', router);

const server = app.listen(3004, () => {
  console.log('✅ Simplified route test server running on port 3004');
  
  const axios = require('axios');
  
  axios.post('http://localhost:3004/api/prokip/auth/connect', {
    userId: 'test-user-123',
    email: 'user@example.com',
    password: 'userpassword',
    connectionName: 'Test Connection'
  })
  .then(response => {
    console.log('✅ Simplified route test successful:', response.data);
    server.close();
    
    console.log('\n🎯 The issue is with express-validator middleware in the original route!');
    console.log('📝 The authentication service works correctly.');
    console.log('🔧 Need to fix the validation middleware in prokipUserRoutes.js');
  })
  .catch(error => {
    console.log('❌ Simplified route test failed:', error.response?.data || error.message);
    server.close();
  });
});
