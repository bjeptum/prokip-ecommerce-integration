require('dotenv').config();

const axios = require('axios');

// Test with your actual credentials to see what's happening
async function testWithRealCredentials() {
  console.log('🧪 Testing with Real Credentials');
  console.log('📝 This will help us debug the exact issue');
  
  try {
    console.log('\n🔍 Testing backend with your credentials...');
    
    // Test with your actual credentials
    const loginData = {
      username: 'kenditrades',
      password: 'testpassword' // Replace with actual password for testing
    };
    
    console.log('📊 Sending request...');
    console.log('📊 URL: http://localhost:3000/auth/prokip-login');
    console.log('📊 Data:', JSON.stringify(loginData, null, 2));
    
    const response = await axios.post('http://localhost:3000/auth/prokip-login', loginData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Success!');
    console.log('📊 Status:', response.status);
    console.log('📊 Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    if (error.response) {
      console.error('📊 Status:', error.response.status);
      console.error('📊 Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Test the service directly to see what it returns
async function testServiceStructure() {
  console.log('\n🧪 Testing Service Response Structure');
  
  try {
    const ProkipUserAuthService = require('./src/services/prokipUserAuthService');
    const authService = new ProkipUserAuthService();
    
    console.log('📝 Testing service with kenditrades...');
    
    const result = await authService.authenticateUser(
      'test-user-123',
      'kenditrades',
      'testpassword',
      'Test Connection'
    );
    
    console.log('✅ Service returned something!');
    console.log('📊 Result type:', typeof result);
    console.log('📊 Result keys:', Object.keys(result));
    console.log('📊 Result.success:', result.success);
    console.log('📊 Result.data type:', typeof result.data);
    
    if (result.data) {
      console.log('📊 Result.data keys:', Object.keys(result.data));
      console.log('📊 Result.data.data type:', typeof result.data.data);
      
      if (result.data.data) {
        console.log('📊 Result.data.data keys:', Object.keys(result.data.data));
        console.log('📊 Result.data.data.user:', result.data.data.user);
        console.log('📊 Result.data.data.connectionId:', result.data.data.connectionId);
      }
    }
    
  } catch (error) {
    console.error('❌ Service test failed:', error.message);
    console.error('📊 Error type:', error.constructor.name);
    console.error('📊 Stack:', error.stack);
  }
}

// Run tests
testWithRealCredentials()
  .then(() => testServiceStructure())
  .catch(console.error);
