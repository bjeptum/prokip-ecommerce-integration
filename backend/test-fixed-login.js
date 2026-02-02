const axios = require('axios');

async function testProkipLogin() {
  try {
    console.log('🧪 Testing Prokip login with fixed authentication...');
    
    const response = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'Myifrit37942949#'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Login successful!');
    console.log('📊 Status:', response.status);
    console.log('📦 Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ Login failed:');
    console.log('📊 Status:', error.response?.status);
    console.log('📦 Error:', error.response?.data);
    console.log('📋 Message:', error.message);
  }
}

testProkipLogin();
