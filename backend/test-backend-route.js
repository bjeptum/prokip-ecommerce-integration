require('dotenv').config();

const axios = require('axios');

// Test the backend route directly to see what's happening
async function testBackendRoute() {
  console.log('🔍 Testing Backend Route Directly');
  console.log('📝 MOCK_PROKIP:', process.env.MOCK_PROKIP);
  
  try {
    console.log('\n🧪 Testing with test credentials...');
    
    const loginData = {
      username: 'kenditrades',
      password: 'testpassword'
    };
    
    console.log('📊 Sending to: http://localhost:3000/auth/prokip-login');
    console.log('📊 Data:', JSON.stringify(loginData, null, 2));
    
    const response = await axios.post('http://localhost:3000/auth/prokip-login', loginData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Backend Response Status:', response.status);
    console.log('✅ Backend Response Headers:', JSON.stringify(response.headers, null, 2));
    console.log('✅ Backend Response Data:', JSON.stringify(response.data, null, 2));
    
    // Check if the response has the expected structure
    if (response.data && response.data.success) {
      console.log('✅ Response has success field');
      console.log('✅ Success value:', response.data.success);
      console.log('✅ Data structure:', JSON.stringify(response.data.data, null, 2));
    } else {
      console.log('❌ Response missing success field');
      console.log('❌ Response structure:', JSON.stringify(response.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Backend route test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Test the service directly to see what it returns
async function testServiceDirectly() {
  console.log('\n🧪 Testing Service Directly');
  
  try {
    const ProkipUserAuthService = require('./src/services/prokipUserAuthService');
    const authService = new ProkipUserAuthService();
    
    console.log('📝 Testing with kenditrades...');
    
    const result = await authService.authenticateUser(
      'debug-user-123',
      'kenditrades',
      'testpassword',
      'Test Connection'
    );
    
    console.log('✅ Service Result Success:', result.success);
    console.log('✅ Service Result Type:', typeof result);
    console.log('✅ Service Result:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✅ Service has success field');
      console.log('✅ Success value:', result.success);
      console.log('✅ Data:', JSON.stringify(result.data, null, 2));
      
      if (result.data && result.data.data) {
        console.log('✅ Result.data.data exists');
        console.log('✅ Result.data.data.user:', result.data.data.user);
        console.log('✅ Result.data.data.token:', result.data.data.token);
      }
    }
    
  } catch (error) {
    console.error('❌ Service test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run tests
testBackendRoute()
  .then(() => testServiceDirectly())
  .catch(console.error);
