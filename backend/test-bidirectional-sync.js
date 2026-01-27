const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testBidirectionalSync() {
  try {
    console.log('🧪 Testing bidirectional sync endpoint...');
    
    // Test the endpoint directly
    const response = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Response status:', response.status);
    console.log('📊 Response data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('🎉 Bidirectional sync endpoint working!');
      const { results } = response.data;
      
      console.log('\n📈 Sync Results:');
      console.log(`WooCommerce → Prokip: ${results.wooToProkip.success}/${results.wooToProkip.processed} successful`);
      console.log(`Prokip → WooCommerce: ${results.prokipToWoo.success}/${results.prokipToWoo.processed} successful`);
      
      if (results.wooToProkip.errors.length > 0) {
        console.log('\n❌ WooCommerce → Prokip errors:');
        results.wooToProkip.errors.forEach(error => console.log(`  - ${error}`));
      }
      
      if (results.prokipToWoo.errors.length > 0) {
        console.log('\n❌ Prokip → WooCommerce errors:');
        results.prokipToWoo.errors.forEach(error => console.log(`  - ${error}`));
      }
    } else {
      console.log('❌ Sync failed:', response.data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testBidirectionalSync();
