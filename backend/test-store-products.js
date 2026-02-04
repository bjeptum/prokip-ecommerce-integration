const axios = require('axios');

async function testStoreProducts() {
  try {
    console.log('🧪 Testing store products endpoint...');
    
    // Login to get token
    const loginResponse = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'Myifrit37942949#'
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.token;
      console.log('✅ Login successful, token present');
      
      // Test store products
      const productsResponse = await axios.get('http://localhost:3000/stores/my-store/products?connectionId=1', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Store products successful!');
      console.log('📊 Products count:', productsResponse.data.products?.length || 0);
      console.log('📦 First product:', productsResponse.data.products?.[0]?.name || 'none');
      
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

testStoreProducts();
