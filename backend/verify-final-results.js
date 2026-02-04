const axios = require('axios');

async function verifyFinalResults() {
  try {
    console.log('🧪 Verifying final results...');
    
    // Login to get token
    const loginResponse = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'Myifrit37942949#'
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.token;
      console.log('✅ Login successful, token present');
      
      // Test 1: Check WooCommerce products
      console.log('\n🧪 Testing final WooCommerce products...');
      try {
        const productsResponse = await axios.get('http://localhost:3000/stores/my-store/products?connectionId=1', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ WooCommerce products retrieved!');
        console.log('📊 Total products:', productsResponse.data.products?.length || 0);
        
        // Check for specific products with real data
        const productsWithStock = productsResponse.data.products?.filter(p => (parseInt(p.stock_quantity) || 0) > 0);
        const productsWithPrice = productsResponse.data.products?.filter(p => (parseFloat(p.price) || 0) > 0);
        
        console.log(`📈 Products with stock > 0: ${productsWithStock?.length || 0}`);
        console.log(`💰 Products with price > 0: ${productsWithPrice?.length || 0}`);
        
        console.log('\n📦 Sample products with REAL data:');
        productsWithStock?.slice(0, 5).forEach(product => {
          console.log(`- ${product.name} (SKU: ${product.sku}) - Stock: ${product.stock_quantity} - Price: ${product.price}`);
        });
        
        // Check for Maseli Dress specifically
        const maseliDress = productsResponse.data.products?.find(p => p.name?.toLowerCase().includes('maseli'));
        if (maseliDress) {
          console.log('\n🎯 Maseli Dress found:');
          console.log(`- Name: ${maseliDress.name}`);
          console.log(`- SKU: ${maseliDress.sku}`);
          console.log(`- Stock: ${maseliDress.stock_quantity}`);
          console.log(`- Price: ${maseliDress.price}`);
          console.log(`- Status: ${maseliDress.status}`);
        }
        
      } catch (productsError) {
        console.error('❌ Products check failed:', productsError.response?.data || productsError.message);
      }
      
      // Test 2: Check inventory sync
      console.log('\n🧪 Testing inventory sync...');
      try {
        const syncResponse = await axios.post('http://localhost:3000/sync/inventory', {
          connectionId: 1
        }, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Inventory sync successful!');
        console.log('📊 Sync response:', JSON.stringify(syncResponse.data, null, 2));
        
      } catch (syncError) {
        console.error('❌ Inventory sync failed:', syncError.response?.data || syncError.message);
      }
      
    } else {
      console.log('❌ Login failed');
    }
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

verifyFinalResults();
