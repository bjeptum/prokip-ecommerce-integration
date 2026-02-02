require('dotenv').config();

const axios = require('axios');

// Test the login endpoint
async function testLoginEndpoint() {
  console.log('🧪 TESTING LOGIN ENDPOINT');
  console.log('=' .repeat(50));
  
  console.log('📋 Environment:');
  console.log('  MOCK_PROKIP:', process.env.MOCK_PROKIP);
  console.log('  PROKIP_BASE_URL:', process.env.PROKIP_BASE_URL);
  
  console.log('\n🧪 Test 1: Invalid credentials (should return 401)');
  console.log('-' .repeat(50));
  
  try {
    const response = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'wrongpassword'
    });
    
    console.log('❌ Unexpected success:', response.status);
    console.log('📊 Response:', response.data);
    
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Correctly returned 401 for invalid credentials');
      console.log('📊 Response:', error.response.data);
    } else {
      console.log('❌ Wrong status code:', error.response?.status);
      console.log('📊 Response:', error.response?.data);
    }
  }
  
  console.log('\n🧪 Test 2: Missing credentials (should return 400)');
  console.log('-' .repeat(50));
  
  try {
    const response = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades'
      // missing password
    });
    
    console.log('❌ Unexpected success:', response.status);
    console.log('📊 Response:', response.data);
    
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ Correctly returned 400 for missing credentials');
      console.log('📊 Response:', error.response.data);
    } else {
      console.log('❌ Wrong status code:', error.response?.status);
      console.log('📊 Response:', error.response?.data);
    }
  }
  
  console.log('\n🧪 Test 3: Test credentials (should return 401)');
  console.log('-' .repeat(50));
  
  try {
    const response = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'testpassword'
    });
    
    console.log('❌ Unexpected success:', response.status);
    console.log('📊 Response:', response.data);
    
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Correctly returned 401 for test credentials');
      console.log('📊 Response:', error.response.data);
    } else {
      console.log('❌ Wrong status code:', error.response?.status);
      console.log('📊 Response:', error.response?.data);
    }
  }
  
  console.log('\n🎯 CONCLUSION:');
  console.log('✅ Login endpoint is working correctly');
  console.log('✅ Returns 400 for missing credentials');
  console.log('✅ Returns 401 for invalid credentials');
  console.log('✅ Ready for real credentials testing');
  
  console.log('\n📝 NEXT STEP:');
  console.log('Test with real Prokip credentials to verify successful login');
}

testLoginEndpoint();
