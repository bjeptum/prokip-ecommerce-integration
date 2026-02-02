require('dotenv').config();

const axios = require('axios');

// Test both servers to identify the issue
async function testBothServers() {
  console.log('🧪 TESTING BOTH SERVERS');
  console.log('=' .repeat(50));
  
  console.log('\n📋 Environment:');
  console.log('  MOCK_PROKIP:', process.env.MOCK_PROKIP);
  console.log('  PROKIP_BASE_URL:', process.env.PROKIP_BASE_URL);
  
  console.log('\n🧪 Test 1: Test Server (Port 3001) - No Middleware');
  console.log('-' .repeat(50));
  
  try {
    const response = await axios.post('http://localhost:3001/test-auth', {
      username: 'kenditrades',
      password: 'testpassword'
    });
    
    console.log('✅ Test Server Success:', response.status);
    console.log('📊 Response:', response.data);
    
  } catch (error) {
    console.log('❌ Test Server Error:');
    console.log('📊 Status:', error.response?.status);
    console.log('📊 Data:', error.response?.data);
    console.log('📊 Message:', error.message);
  }
  
  console.log('\n🧪 Test 2: Main Server (Port 3000) - With Middleware');
  console.log('-' .repeat(50));
  
  try {
    const response = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'testpassword'
    });
    
    console.log('✅ Main Server Success:', response.status);
    console.log('📊 Response:', response.data);
    
  } catch (error) {
    console.log('❌ Main Server Error:');
    console.log('📊 Status:', error.response?.status);
    console.log('📊 Data:', error.response?.data);
    console.log('📊 Message:', error.message);
  }
  
  console.log('\n🧪 Test 3: Direct Service Call');
  console.log('-' .repeat(50));
  
  try {
    const ProkipUserAuthService = require('./src/services/prokipUserAuthService');
    const authService = new ProkipUserAuthService();
    
    const result = await authService.authenticateUser(
      'test-user-123',
      'kenditrades',
      'testpassword',
      'Test Connection'
    );
    
    console.log('✅ Direct Service Success:', result.success);
    console.log('📊 Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.log('❌ Direct Service Error:');
    console.log('📊 Message:', error.message);
    console.log('📊 Type:', error.constructor.name);
  }
  
  console.log('\n🎯 ANALYSIS:');
  console.log('If Test Server (3001) returns 401 and Main Server (3000) returns 400:');
  console.log('→ The issue is in the main server\'s middleware or routing');
  console.log('→ The authentication service is working correctly');
  console.log('→ We need to fix the middleware issue in the main server');
  
  console.log('\nIf both servers return 401:');
  console.log('→ The issue is in the frontend caching or browser');
  console.log('→ The backend is working correctly');
  console.log('→ We need to fix the frontend caching issue');
}

testBothServers();
