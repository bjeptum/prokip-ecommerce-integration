const axios = require('axios');

async function testProkipLocation() {
  try {
    console.log('🧪 Testing prokip-location endpoint...');
    
    const response = await axios.post('http://localhost:3000/auth/prokip-location', {
      locationId: '21334',
      access_token: 'test_token',
      refresh_token: null,
      expires_in: 86400,
      username: 'kenditrades'
    });
    
    console.log('✅ Response:', response.data);
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    }
  }
}

testProkipLocation();
