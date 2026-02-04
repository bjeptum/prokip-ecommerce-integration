const axios = require('axios');

async function testFixedPush() {
  try {
    console.log('🧪 Testing FIXED push products from Prokip to WooCommerce...');
    
    // Login to get token
    const loginResponse = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'Myifrit37942949#'
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.token;
      console.log('✅ Login successful, token present');
      
      // Test push products with the FIXED logic
      console.log('\n🧪 Testing FIXED /setup/products (push)...');
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
        
        console.log('✅ FIXED Push products successful!');
        console.log('📊 Response:', JSON.stringify(pushResponse.data, null, 2));
        
        // Show stock and price details
        if (pushResponse.data.results) {
          console.log('\n📈 Stock and Price Analysis:');
          const withStock = pushResponse.data.results.filter(r => r.status === 'success' && r.stock > 0);
          const withPrice = pushResponse.data.results.filter(r => r.status === 'success' && r.price > 0);
          
          console.log(`✅ Products with stock > 0: ${withStock.length}`);
          console.log(`💰 Products with price > 0: ${withPrice.length}`);
          
          console.log('\n📦 Sample products with stock:');
          withStock.slice(0, 5).forEach(result => {
            console.log(`- ${result.sku}: Stock=${result.stock}, Price=${result.price}`);
          });
        }
        
      } catch (pushError) {
        console.error('❌ FIXED Push products failed:', pushError.response?.data || pushError.message);
      }
      
    } else {
      console.log('❌ Login failed');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFixedPush();
