// Test minimal route definition
const express = require('express');
const app = express();
app.use(express.json());

console.log('🧪 Testing minimal route definition...');

// Create a simple router
const router = express.Router();

// Add a simple test route
router.post('/auth/connect', (req, res) => {
  console.log('🎯 Route hit!', req.body);
  res.json({
    success: true,
    message: 'Test route working',
    data: req.body
  });
});

// Mount the router
app.use('/api/prokip', router);

// Start server
const server = app.listen(3002, () => {
  console.log('✅ Minimal test server running on port 3002');
  
  // Test the route
  const axios = require('axios');
  
  axios.post('http://localhost:3002/api/prokip/auth/connect', {
    userId: 'test-123',
    email: 'test@example.com',
    password: 'test'
  })
  .then(response => {
    console.log('✅ Minimal route test successful:', response.data);
    server.close();
    
    // Now test with the actual routes
    console.log('\n🧪 Testing actual prokipUserRoutes...');
    testActualRoutes();
  })
  .catch(error => {
    console.log('❌ Minimal route test failed:', error.response?.data || error.message);
    server.close();
  });
});

function testActualRoutes() {
  const express = require('express');
  const app2 = express();
  app2.use(express.json());
  
  try {
    const prokipUserRoutes = require('./src/routes/prokipUserRoutes');
    app2.use('/api/prokip', prokipUserRoutes);
    
    const server2 = app2.listen(3003, () => {
      console.log('✅ Actual routes test server running on port 3003');
      
      const axios = require('axios');
      
      axios.post('http://localhost:3003/api/prokip/auth/connect', {
        userId: 'test-123',
        email: 'test@example.com',
        password: 'test'
      })
      .then(response => {
        console.log('✅ Actual routes test successful:', response.data);
        server2.close();
      })
      .catch(error => {
        console.log('❌ Actual routes test failed:', error.response?.data || error.message);
        if (error.response) {
          console.log('Status:', error.response.status);
          console.log('Headers:', error.response.headers);
        }
        server2.close();
      });
    });
    
  } catch (error) {
    console.error('❌ Failed to load actual routes:', error.message);
    console.error('Stack:', error.stack);
  }
}
