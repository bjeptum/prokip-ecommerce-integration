require('dotenv').config();

const axios = require('axios');

// Test login with detailed logging
async function testLoginWithLogging() {
  console.log('🔍 TESTING LOGIN WITH DETAILED LOGGING');
  console.log('=' .repeat(50));
  
  console.log('📋 Environment:');
  console.log('  MOCK_PROKIP:', process.env.MOCK_PROKIP);
  console.log('  PROKIP_BASE_URL:', process.env.PROKIP_BASE_URL);
  
  console.log('\n🧪 Test 1: Login with username (kenditrades)');
  console.log('-' .repeat(40));
  
  try {
    const response = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'testpassword'
    });
    
    console.log('✅ Login Success:', response.status);
    console.log('📊 Response:', response.data);
    
  } catch (error) {
    console.log('❌ Login Error:');
    console.log('📊 Status:', error.response?.status);
    console.log('📊 Response:', error.response?.data);
    console.log('📊 Message:', error.message);
  }
  
  console.log('\n🧪 Test 2: Login with email format');
  console.log('-' .repeat(40));
  
  try {
    const response = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades@prokip.africa', // Try email format
      password: 'testpassword'
    });
    
    console.log('✅ Login Success:', response.status);
    console.log('📊 Response:', response.data);
    
  } catch (error) {
    console.log('❌ Login Error:');
    console.log('📊 Status:', error.response?.status);
    console.log('📊 Response:', error.response?.data);
    console.log('📊 Message:', error.message);
  }
  
  console.log('\n🧪 Test 3: Check server logs for authentication flow');
  console.log('-' .repeat(40));
  
  console.log('📝 Check server console output for:');
  console.log('  - "Login attempt received"');
  console.log('  - "Identifier received"');
  console.log('  - "Identifier type (looks like email?)"');
  console.log('  - "Attempting web authentication"');
  console.log('  - "Obtained CSRF token"');
  console.log('  - "Web authentication successful" OR error messages');
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('1. Check server logs to see authentication flow');
  console.log('2. Identify if Prokip expects username or email');
  console.log('3. Fix identifier handling accordingly');
  console.log('4. Test with real credentials');
}

testLoginWithLogging();
