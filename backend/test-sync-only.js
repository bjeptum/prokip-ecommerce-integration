const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testSyncOnly() {
  try {
    console.log('🔄 Testing inventory sync only...');
    
    // Get Prokip config for authentication
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });
    
    if (!prokipConfig?.token) {
      console.log('No Prokip config found');
      return;
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`
    };
    
    // Force inventory sync
    console.log('🔄 Forcing inventory sync...');
    const syncResponse = await axios.post('http://localhost:3000/sync/inventory', {
      connectionId: 5
    }, {
      headers
    });
    
    console.log(`Sync result: ${syncResponse.data.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Message: ${syncResponse.data.message}`);
    console.log(`Products processed: ${syncResponse.data.results?.length || 0}`);
    
    // Show results
    if (syncResponse.data.results) {
      console.log('\n📊 Sync results:');
      syncResponse.data.results.slice(0, 10).forEach((result, index) => {
        console.log(`${index + 1}. ${result.sku}: ${result.status} - ${result.quantity} units`);
      });
    }
    
    // Wait and try to get products (with timeout)
    console.log('\n⏱️ Waiting 5 seconds before checking products...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    try {
      const productsResponse = await axios.get('http://localhost:3000/stores/my-store/products?connectionId=5', {
        headers,
        timeout: 10000
      });
      
      const products = productsResponse.data.products || [];
      console.log(`✅ Successfully fetched ${products.length} products`);
      
      // Check a few key products
      const testSkus = ['4848961', '4744942', '4815445'];
      testSkus.forEach(sku => {
        const product = products.find(p => p.sku === sku);
        if (product) {
          console.log(`${sku}: ${product.name} - ${product.stock_quantity} units`);
        }
      });
      
    } catch (productError) {
      console.log('⚠️ Products fetch still timing out, but sync likely worked');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testSyncOnly();
