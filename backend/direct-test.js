require('dotenv').config();

const axios = require('axios');

// Direct test to see what's happening
async function directTest() {
  console.log('🔍 DIRECT TEST - What is actually happening?');
  console.log('=' .repeat(50));
  
  console.log('📋 Environment:');
  console.log('  MOCK_PROKIP:', process.env.MOCK_PROKIP);
  console.log('  PROKIP_BASE_URL:', process.env.PROKIP_BASE_URL);
  
  console.log('\n🧪 Test 1: Direct backend call');
  console.log('-' .repeat(30));
  
  try {
    const response = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'testpassword'
    });
    
    console.log('✅ Unexpected success:', response.status);
    console.log('📊 Response:', response.data);
    
  } catch (error) {
    console.log('❌ Error caught:');
    console.log('📊 Status:', error.response?.status);
    console.log('📊 Data:', error.response?.data);
    console.log('📊 Message:', error.message);
  }
  
  console.log('\n🧪 Test 2: With timestamp (like frontend)');
  console.log('-' .repeat(30));
  
  try {
    const timestamp = Date.now();
    const response = await axios.post(`http://localhost:3000/auth/prokip-login?t=${timestamp}`, {
      username: 'kenditrades',
      password: 'testpassword'
    }, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    console.log('✅ Unexpected success with timestamp:', response.status);
    console.log('📊 Response:', response.data);
    
  } catch (error) {
    console.log('❌ Error caught with timestamp:');
    console.log('📊 Status:', error.response?.status);
    console.log('📊 Data:', error.response?.data);
    console.log('📊 Message:', error.message);
  }
  
  console.log('\n🧪 Test 3: Check server health');
  console.log('-' .repeat(30));
  
  try {
    const response = await axios.get('http://localhost:3000/health');
    console.log('✅ Server health:', response.data);
  } catch (error) {
    console.log('❌ Server health error:', error.message);
  }
  
  console.log('\n🔍 Let me check what the server is actually receiving...');
}

directTest();
