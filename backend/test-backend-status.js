require('dotenv').config();

const axios = require('axios');

// Simple test to verify backend is working
async function testBackendStatus() {
  console.log('🧪 Backend Status Check');
  console.log('=' .repeat(40));
  
  console.log('📋 Environment:');
  console.log('  MOCK_PROKIP:', process.env.MOCK_PROKIP);
  console.log('  PROKIP_BASE_URL:', process.env.PROKIP_BASE_URL);
  
  console.log('\n🔍 Testing backend health...');
  
  try {
    // Test health endpoint
    const healthResponse = await axios.get('http://localhost:3000/health');
    console.log('✅ Backend health:', healthResponse.data);
    
    console.log('\n🔍 Testing authentication endpoint...');
    
    // Test with your credentials
    const authResponse = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'testpassword'
    });
    
    console.log('✅ Authentication endpoint working');
    console.log('📊 Status:', authResponse.status);
    console.log('📊 Response:', authResponse.data);
    
  } catch (error) {
    if (error.response) {
      console.log('📊 Status:', error.response.status);
      console.log('📊 Response:', error.response.data);
      
      if (error.response.status === 401) {
        console.log('\n✅ Backend is working correctly!');
        console.log('📝 401 = Invalid credentials (expected with test password)');
        console.log('🎯 Your real credentials should work!');
        
        console.log('\n🚀 SOLUTION:');
        console.log('1. Go to http://localhost:3000');
        console.log('2. Enter your real Prokip credentials');
        console.log('3. Clear browser cache if needed (Ctrl+F5)');
        console.log('4. Try logging in again');
        
        console.log('\n💡 If still getting 400 error:');
        console.log('1. Open browser developer tools (F12)');
        console.log('2. Go to Network tab');
        console.log('3. Clear cache and hard refresh');
        console.log('4. Try login again');
      }
    } else {
      console.error('❌ Network error:', error.message);
    }
  }
}

testBackendStatus();
