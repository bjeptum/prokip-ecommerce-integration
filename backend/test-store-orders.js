const axios = require('axios');

async function testStoreOrders() {
  try {
    console.log('🧪 Testing store orders endpoint...');
    
    // Login to get token
    const loginResponse = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'Myifrit37942949#'
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.token;
      console.log('✅ Login successful, token present');
      
      // Test store orders
      const ordersResponse = await axios.get('http://localhost:3000/stores/my-store/orders?connectionId=1', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Store orders successful!');
      console.log('📊 Orders count:', ordersResponse.data.orders?.length || 0);
      console.log('📦 First order:', ordersResponse.data.orders?.[0]?.id || 'none');
      
    } else {
      console.log('❌ Login failed');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('📊 Status:', error.response.status);
      console.error('📦 Data:', error.response.data);
    }
  }
}

testStoreOrders();
