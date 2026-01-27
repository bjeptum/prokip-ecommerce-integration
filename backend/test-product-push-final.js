const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testProductPush() {
  try {
    console.log('🔄 Testing product push from frontend...');
    
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
      connectionId: 4
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
      
      // Show individual results
      response.data.results?.forEach((result, index) => {
        const status = result.status === 'success' ? '✅' : '❌';
        console.log(`${status} Product ${index + 1}: ${result.sku} - ${result.status}`);
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
      });
    } else {
      console.log(`❌ FAILED: ${response.data.error}`);
    }
    
  } catch (error) {
    console.error('❌ Product push test failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testProductPush();
