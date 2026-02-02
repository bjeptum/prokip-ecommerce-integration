// Test the routes directly
console.log('🧪 Testing routes directly...');

try {
  const express = require('express');
  const app = express();
  app.use(express.json());
  
  console.log('1️⃣ Importing prokipUserRoutes...');
  const prokipUserRoutes = require('./src/routes/prokipUserRoutes');
  
  console.log('2️⃣ Mounting routes...');
  app.use('/api/prokip', prokipUserRoutes);
  
  console.log('3️⃣ Starting test server...');
  const server = app.listen(3001, () => {
    console.log('✅ Test server running on port 3001');
    
    // Test the route
    const axios = require('axios');
    
    axios.post('http://localhost:3001/api/prokip/auth/connect', {
      userId: 'test-123',
      email: 'test@example.com',
      password: 'test'
    })
    .then(response => {
      console.log('✅ Route test successful:', response.data);
      server.close();
    })
    .catch(error => {
      console.log('❌ Route test failed:', error.response?.data || error.message);
      server.close();
    });
  });
  
} catch (error) {
  console.error('❌ Route test failed:', error.message);
  console.error('Stack:', error.stack);
}
