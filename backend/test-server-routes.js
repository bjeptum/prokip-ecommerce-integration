require('dotenv').config();

const axios = require('axios');

// Test basic server connectivity and routes
async function testServerRoutes() {
  console.log('🧪 Testing Server Routes');
  
  try {
    // Test basic health endpoint
    console.log('\n1️⃣ Testing health endpoint...');
    const healthResponse = await axios.get('http://localhost:3000/health');
    console.log('✅ Health endpoint working:', healthResponse.data);
    
    // Test basic auth endpoint
    console.log('\n2️⃣ Testing basic auth endpoint...');
    try {
      const authResponse = await axios.get('http://localhost:3000/auth');
      console.log('✅ Auth endpoint accessible');
    } catch (error) {
      console.log('ℹ️ Auth endpoint returns:', error.response.status);
    }
    
    // Test prokip routes base
    console.log('\n3️⃣ Testing prokip routes base...');
    try {
      const prokipResponse = await axios.get('http://localhost:3000/prokip');
      console.log('✅ Prokip base endpoint accessible');
    } catch (error) {
      console.log('ℹ️ Prokip base endpoint returns:', error.response.status);
    }
    
    // Test API prokip routes base
    console.log('\n4️⃣ Testing API prokip routes base...');
    try {
      const apiProkipResponse = await axios.get('http://localhost:3000/api/prokip');
      console.log('✅ API Prokip base endpoint accessible');
    } catch (error) {
      console.log('ℹ️ API Prokip base endpoint returns:', error.response.status);
    }
    
    // Test the specific auth connect route
    console.log('\n5️⃣ Testing specific auth connect route...');
    try {
      const connectResponse = await axios.post('http://localhost:3000/api/prokip/auth/connect', {
        userId: 'test',
        email: 'test@example.com',
        password: 'test'
      });
      console.log('✅ Auth connect route working:', connectResponse.data);
    } catch (error) {
      console.log('❌ Auth connect route failed:', error.response.status);
      console.log('Response:', error.response.data);
    }
    
  } catch (error) {
    console.error('❌ Server test failed:', error.message);
  }
}

// Run the test
testServerRoutes();
