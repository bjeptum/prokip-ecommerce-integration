const axios = require('axios');

async function testSyncButton() {
  try {
    console.log('🧪 Testing sync button functionality...');
    
    // Test the API endpoint that the button calls
    const response = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Response status:', response.status);
    console.log('📊 Response data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('🎉 Sync button API is working!');
      const { results } = response.data;
      
      console.log('\n📈 Sync Results:');
      console.log(`WooCommerce → Prokip: ${results.wooToProkip.success}/${results.wooToProkip.processed} successful`);
      if (results.wooToProkip.stockDeducted) {
        console.log(`Stock deducted: ${results.wooToProkip.stockDeducted} items`);
      }
      
      console.log(`Prokip → WooCommerce: ${results.prokipToWoo.success}/${results.prokipToWoo.processed} successful`);
      if (results.prokipToWoo.stockUpdated) {
        console.log(`Stock updated: ${results.prokipToWoo.stockUpdated} items`);
      }
      
      if (results.wooToProkip.errors.length > 0 || results.prokipToWoo.errors.length > 0) {
        console.log('\n⚠️ Some errors occurred (this is normal if WooCommerce API credentials need updating)');
      }
      
    } else {
      console.log('❌ Sync failed:', response.data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testSyncButton();
