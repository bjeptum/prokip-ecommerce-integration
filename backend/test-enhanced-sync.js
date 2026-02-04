const axios = require('axios');

async function testEnhancedBidirectionalSync() {
  try {
    console.log('🧪 TESTING: Enhanced Bidirectional Sync with All Improvements');
    console.log('✅ Features:');
    console.log('   - Strict SKU validation');
    console.log('   - Per-SKU idempotency tracking');
    console.log('   - Stock verification after deduction');
    console.log('   - Only mark success if stock actually reduced');
    console.log('   - Enhanced error logging and retry logic');
    
    // Login to get token
    const loginResponse = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'Myifrit37942949#'
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.token;
      console.log('✅ Login successful, token present');
      
      // Test the enhanced bidirectional sync
      console.log('\n🧪 Running enhanced bidirectional sync...');
      
      try {
        const syncResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Enhanced bidirectional sync completed!');
        console.log('📊 Results:', JSON.stringify(syncResponse.data, null, 2));
        
        const { results } = syncResponse.data;
        
        if (results.wooToProkip) {
          console.log('\n🔍 WooCommerce → Prokip Analysis:');
          console.log(`   - Orders processed: ${results.wooToProkip.processed}`);
          console.log(`   - Orders successful: ${results.wooToProkip.success}`);
          console.log(`   - Stock deducted: ${results.wooToProkip.stockDeducted} units`);
          console.log(`   - Errors: ${results.wooToProkip.errors.length}`);
          
          if (results.wooToProkip.errors.length > 0) {
            console.log('\n❌ Errors encountered:');
            results.wooToProkip.errors.forEach((error, index) => {
              console.log(`   ${index + 1}. ${error}`);
            });
          }
          
          if (results.wooToProkip.stockDeducted > 0) {
            console.log('\n🎉 SUCCESS! Stock was actually deducted from Prokip!');
            console.log('✅ The enhanced system is working correctly.');
          } else {
            console.log('\n⚠️ No stock was deducted. This could mean:');
            console.log('   - No new orders to process');
            console.log('   - All orders already processed');
            console.log('   - Stock verification failed (check errors above)');
          }
        }
        
      } catch (syncError) {
        console.error('❌ Enhanced bidirectional sync failed:', syncError.response?.data || syncError.message);
      }
      
    } else {
      console.log('❌ Login failed');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testEnhancedBidirectionalSync();
