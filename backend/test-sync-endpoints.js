const axios = require('axios');

async function testSyncEndpoints() {
  try {
    console.log('🧪 Testing sync endpoints...');
    
    // Login to get token
    const loginResponse = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'Myifrit37942949#'
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.token;
      console.log('✅ Login successful, token present');
      
      // Test setup/products endpoint (push products to Prokip)
      console.log('\n🧪 Testing /setup/products (push)...');
      try {
        const pushResponse = await axios.post('http://localhost:3000/setup/products', {
          method: 'push',
          connectionId: 1
        }, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Setup/products push successful!');
        console.log('📊 Response:', pushResponse.data);
      } catch (pushError) {
        console.error('❌ Setup/products push failed:', pushError.response?.data || pushError.message);
      }
      
      // Test sync/inventory endpoint (sync Prokip to WooCommerce)
      console.log('\n🧪 Testing /sync/inventory...');
      try {
        const syncResponse = await axios.post('http://localhost:3000/sync/inventory', {
          connectionId: 1
        }, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Sync/inventory successful!');
        console.log('📊 Response:', syncResponse.data);
      } catch (syncError) {
        console.error('❌ Sync/inventory failed:', syncError.response?.data || syncError.message);
      }
      
    } else {
      console.log('❌ Login failed');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSyncEndpoints();
