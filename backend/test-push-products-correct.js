const axios = require('axios');

async function testPushProducts() {
  try {
    console.log('🧪 Testing push products from Prokip to WooCommerce...');
    
    // Login to get token
    const loginResponse = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'Myifrit37942949#'
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.token;
      console.log('✅ Login successful, token present');
      
      // Test push products (Prokip to WooCommerce)
      console.log('\n🧪 Testing /setup/products (push - Prokip to WooCommerce)...');
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
        
        console.log('✅ Push products successful!');
        console.log('📊 Response:', JSON.stringify(pushResponse.data, null, 2));
      } catch (pushError) {
        console.error('❌ Push products failed:', pushError.response?.data || pushError.message);
      }
      
    } else {
      console.log('❌ Login failed');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testPushProducts();
