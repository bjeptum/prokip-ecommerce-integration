const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testProductPushStore5() {
  try {
    console.log('🔄 Testing product push to Store 5 with update logic...');
    
    // Get Prokip config for authentication
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });
    
    if (!prokipConfig?.token) {
      console.log('No Prokip config found');
      return;
    }
    
    // Test the exact same request as frontend
    const response = await axios.post('http://localhost:3000/setup/products', {
      method: 'push',
      connectionId: 5
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${prokipConfig.token}`
      }
    });
    
    console.log('✅ Product push response:', response.data);
    
    if (response.data.success) {
      console.log(`🎉 SUCCESS! ${response.data.message}`);
      console.log(`📊 Results: ${response.data.results?.length || 0} products processed`);
      
      // Count successes vs errors
      const successes = response.data.results?.filter(r => r.status === 'success').length || 0;
      const errors = response.data.results?.filter(r => r.status === 'error').length || 0;
      
      console.log(`✅ Successful updates: ${successes}`);
      console.log(`❌ Errors: ${errors}`);
      
      if (errors > 0) {
        console.log('\n📋 Error details:');
        response.data.results?.filter(r => r.status === 'error').forEach((result, index) => {
          console.log(`${index + 1}. SKU ${result.sku}: ${result.error}`);
        });
      }
    } else {
      console.log(`❌ FAILED: ${response.data.error}`);
    }
    
  } catch (error) {
    console.error('❌ Product push test failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testProductPushStore5();
