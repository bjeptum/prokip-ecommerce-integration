const axios = require('axios');

async function testBidirectionalSync() {
  try {
    console.log('🧪 Testing bidirectional sync endpoint...');
    
    // First login to get token
    const loginResponse = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'Myifrit37942949#'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.token;
      console.log('✅ Login successful, token:', token ? 'present' : 'missing');
      
      // Test bidirectional sync
      const syncResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Bidirectional sync successful!');
      console.log('📊 Response:', JSON.stringify(syncResponse.data, null, 2));
      
    } else {
      console.log('❌ Login failed:', loginResponse.data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('📊 Status:', error.response.status);
      console.error('📦 Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testBidirectionalSync();
