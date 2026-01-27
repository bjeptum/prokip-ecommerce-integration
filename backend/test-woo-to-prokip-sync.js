/**
 * Test the fixed WooCommerce to Prokip stock deduction
 */

const axios = require('axios');

async function testWooToProkipSync() {
  try {
    console.log('🔄 Testing fixed WooCommerce → Prokip sync...\n');

    // Call the bidirectional sync endpoint
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
      
      console.log('\n📊 WooCommerce → Prokip Results:');
      console.log(`- Orders processed: ${wooToProkip.processed}`);
      console.log(`- Orders successfully synced: ${wooToProkip.success}`);
      console.log(`- Stock deducted: ${wooToProkip.stockDeducted} items`);
      
      if (wooToProkip.errors.length > 0) {
        console.log(`- Errors: ${wooToProkip.errors.length}`);
        wooToProkip.errors.forEach(error => {
          console.log(`  ❌ ${error}`);
        });
      }

      console.log('\n📊 Prokip → WooCommerce Results:');
      console.log(`- Sales processed: ${prokipToWoo.processed}`);
      console.log(`- Sales successfully synced: ${prokipToWoo.success}`);
      console.log(`- Stock updated: ${prokipToWoo.stockUpdated} items`);
      
      if (prokipToWoo.errors.length > 0) {
        console.log(`- Errors: ${prokipToWoo.errors.length}`);
        prokipToWoo.errors.forEach(error => {
          console.log(`  ❌ ${error}`);
        });
      }

      // Check if stock was actually deducted
      if (wooToProkip.success > 0 && wooToProkip.stockDeducted > 0) {
        console.log('\n🎉 SUCCESS: WooCommerce sales were synced to Prokip and stock was deducted!');
      } else if (wooToProkip.processed > 0) {
        console.log('\n⚠️ Orders were processed but no stock was deducted. Check the errors above.');
      } else {
        console.log('\n📝 No WooCommerce orders were found to process. This might be normal if there are no recent orders.');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testWooToProkipSync();
