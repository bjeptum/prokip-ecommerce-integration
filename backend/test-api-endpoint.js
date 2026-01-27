const axios = require('axios');

async function testApiEndpoint() {
  try {
    console.log('🧪 Testing bidirectional sync API endpoint...');
    
    const response = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }
    });
    
    console.log('✅ API call successful!');
    console.log('Response:', response.data);
    
  } catch (error) {
    console.error('❌ API call failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testApiEndpoint();
