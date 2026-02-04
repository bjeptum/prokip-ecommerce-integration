const axios = require('axios');

async function testCompleteStockUpdate() {
  try {
    console.log('🧪 Testing COMPLETE stock update: Prokip + WooCommerce...');
    
    // Login to get token
    const loginResponse = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'Myifrit37942949#'
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.token;
      console.log('✅ Login successful, token present');
      
      // Check current WooCommerce stock before sync
      console.log('\n🧪 Checking WooCommerce stock before sync...');
      try {
        const productsResponse = await axios.get('http://localhost:3000/stores/my-store/products?connectionId=1', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        const maridaFoundation = productsResponse.data.products?.find(p => p.sku === '4922111');
        if (maridaFoundation) {
          console.log(`📊 Marida Foundation (SKU 4922111) current stock: ${maridaFoundation.stock_quantity}`);
        }
        
      } catch (productsError) {
        console.error('❌ Failed to check WooCommerce stock:', productsError.response?.data || productsError.message);
      }
      
      // Test the fixed bidirectional sync
      console.log('\n🧪 Testing FIXED bidirectional sync with WooCommerce stock update...');
      try {
        const syncResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Bidirectional sync completed!');
        console.log('📊 Response:', JSON.stringify(syncResponse.data, null, 2));
        
        // Check WooCommerce stock after sync
        console.log('\n🧪 Checking WooCommerce stock after sync...');
        try {
          const productsResponse = await axios.get('http://localhost:3000/stores/my-store/products?connectionId=1', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          const maridaFoundation = productsResponse.data.products?.find(p => p.sku === '4922111');
          if (maridaFoundation) {
            console.log(`📊 Marida Foundation (SKU 4922111) updated stock: ${maridaFoundation.stock_quantity}`);
          }
          
        } catch (productsError) {
          console.error('❌ Failed to check updated WooCommerce stock:', productsError.response?.data || productsError.message);
        }
        
      } catch (syncError) {
        console.error('❌ Bidirectional sync failed:', syncError.response?.data || syncError.message);
      }
      
    } else {
      console.log('❌ Login failed');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCompleteStockUpdate();
