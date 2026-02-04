const axios = require('axios');

async function testBidirectionalSync() {
  try {
    console.log('🧪 Testing FIXED bidirectional sync with stock deduction...');
    
    // Login to get token
    const loginResponse = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'Myifrit37942949#'
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.token;
      console.log('✅ Login successful, token present');
      
      // Test the fixed bidirectional sync
      console.log('\n🧪 Testing FIXED /bidirectional-sync/sync-woocommerce...');
      try {
        const syncResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Bidirectional sync successful!');
        console.log('📊 Response:', JSON.stringify(syncResponse.data, null, 2));
        
        // Show detailed results
        if (syncResponse.data.results) {
          const wooToProkip = syncResponse.data.results.wooToProkip;
          console.log('\n📈 WooCommerce → Prokip Results:');
          console.log(`- Orders processed: ${wooToProkip.processed}`);
          console.log(`- Orders successful: ${wooToProkip.success}`);
          console.log(`- Stock deducted: ${wooToProkip.stockDeducted}`);
          console.log(`- Errors: ${wooToProkip.errors.length}`);
          
          if (wooToProkip.errors.length > 0) {
            console.log('\n❌ Errors:');
            wooToProkip.errors.forEach(error => console.log(`  - ${error}`));
          }
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

testBidirectionalSync();
