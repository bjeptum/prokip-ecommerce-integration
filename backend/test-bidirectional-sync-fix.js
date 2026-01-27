/**
 * Test the fixed bidirectional sync functionality
 */

const axios = require('axios');

async function testBidirectionalSync() {
  try {
    console.log('🔄 Testing fixed bidirectional sync...\n');

    // Call the sync endpoint
    const response = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // Will use default userId in middleware
      }
    });

    console.log('✅ Sync completed successfully!');
    console.log('Response:', JSON.stringify(response.data, null, 2));

    // Check the results
    if (response.data.success && response.data.results) {
      const { wooToProkip, prokipToWoo } = response.data.results;
      
      console.log('\n📊 Sync Results Summary:');
      console.log(`WooCommerce → Prokip: ${wooToProkip.success}/${wooToProkip.processed} orders synced`);
      if (wooToProkip.stockDeducted > 0) {
        console.log(`  - ${wooToProkip.stockDeducted} items deducted from stock`);
      }
      if (wooToProkip.errors.length > 0) {
        console.log(`  - ${wooToProkip.errors.length} errors occurred`);
      }

      console.log(`Prokip → WooCommerce: ${prokipToWoo.success}/${prokipToWoo.processed} sales synced`);
      if (prokipToWoo.stockUpdated > 0) {
        console.log(`  - ${prokipToWoo.stockUpdated} items updated in WooCommerce`);
      }
      if (prokipToWoo.errors.length > 0) {
        console.log(`  - ${prokipToWoo.errors.length} errors occurred`);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testBidirectionalSync();
