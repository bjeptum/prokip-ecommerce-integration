const axios = require('axios');

async function testFrontendDataFlow() {
  try {
    console.log('🧪 Testing frontend data flow...');
    
    // Login to get token
    const loginResponse = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'Myifrit37942949#'
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.token;
      console.log('✅ Login successful, token present');
      
      // Test 1: Get products (what frontend sees)
      console.log('\n🧪 Testing /stores/my-store/products (frontend data)...');
      try {
        const productsResponse = await axios.get('http://localhost:3000/stores/my-store/products?connectionId=1', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Products endpoint successful!');
        console.log('📊 Response structure:', {
          hasProducts: !!productsResponse.data.products,
          productsCount: productsResponse.data.products?.length || 0,
          hasSuccess: !!productsResponse.data.success,
          hasConnectionId: !!productsResponse.data.connectionId,
          responseKeys: Object.keys(productsResponse.data)
        });
        
        // Check for Maseli Dress specifically
        const maseliDress = productsResponse.data.products?.find(p => 
          p.name?.toLowerCase().includes('maseli') || 
          p.name?.toLowerCase().includes('dress')
        );
        
        console.log('🔍 Maseli Dress search:', {
          found: !!maseliDress,
          name: maseliDress?.name,
          sku: maseliDress?.sku,
          stock: maseliDress?.stock_quantity,
          status: maseliDress?.status
        });
        
        // Show first few products
        console.log('📦 First 5 products:');
        productsResponse.data.products?.slice(0, 5).forEach((product, index) => {
          console.log(`  ${index + 1}. ${product.name} (SKU: ${product.sku}) - Stock: ${product.stock_quantity}`);
        });
        
      } catch (productsError) {
        console.error('❌ Products endpoint failed:', productsError.response?.data || productsError.message);
      }
      
      // Test 2: Push products (simulate frontend action)
      console.log('\n🧪 Testing /setup/products push (simulate frontend)...');
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
        console.log('📊 Response structure:', {
          success: pushResponse.data.success,
          message: pushResponse.data.message,
          hasResults: !!pushResponse.data.results,
          resultsCount: pushResponse.data.results?.length || 0
        });
        
        // Show success/error breakdown
        if (pushResponse.data.results) {
          const success = pushResponse.data.results.filter(r => r.status === 'success').length;
          const errors = pushResponse.data.results.filter(r => r.status === 'error').length;
          console.log(`📈 Results: ${success} success, ${errors} errors`);
        }
        
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

testFrontendDataFlow();
