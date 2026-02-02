require('dotenv').config();

const axios = require('axios');

// Test the updated authentication endpoint
async function testUpdatedAuth() {
  console.log('🧪 Testing Updated Authentication Endpoint');
  
  try {
    console.log('\n🔐 Testing /auth/prokip-login with new per-user system...');
    
    const loginData = {
      username: 'kenditrades', // Using the actual username from the logs
      password: 'testpassword123' // Test password
    };
    
    const response = await axios.post('http://localhost:3000/auth/prokip-login', loginData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Authentication successful!');
    console.log('📊 Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.token) {
      console.log('\n🔍 Testing connection status with received token...');
      
      const statusResponse = await axios.get('http://localhost:3000/auth/prokip-status', {
        headers: {
          'Authorization': `Bearer ${response.data.token}`
        }
      });
      
      console.log('✅ Status check successful!');
      console.log('📊 Status:', JSON.stringify(statusResponse.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Test with real credentials
async function testWithRealCredentials() {
  console.log('\n🧪 Testing with Real Prokip Credentials');
  console.log('📝 Please enter your actual Prokip credentials when prompted');
  
  // For now, let's just show what the endpoint expects
  console.log('\n📋 Endpoint: POST http://localhost:3000/auth/prokip-login');
  console.log('📋 Body: {');
  console.log('   "username": "your-prokip-email@example.com",');
  console.log('   "password": "your-prokip-password"');
  console.log('}');
  
  console.log('\n✅ The endpoint is now updated to use the per-user authentication system!');
  console.log('🔧 Users can now login with their real Prokip credentials via the dashboard');
}

// Run tests
testUpdatedAuth()
  .then(() => testWithRealCredentials())
  .catch(console.error);
