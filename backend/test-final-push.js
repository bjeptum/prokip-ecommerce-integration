const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testFinalProductPush() {
  try {
    console.log('Testing final product push to WooCommerce...');
    
    // Get Prokip config for authentication
    const prokipConfig = await prisma.prokipConfig.findFirst();
    if (!prokipConfig?.token) {
      console.log('No Prokip token found');
      return;
    }
    
    console.log('Using Prokip token for authentication...');
    
    // Test the exact same request that frontend makes
    const pushResponse = await axios.post('http://localhost:3000/setup/products', {
      method: 'push',
      connectionId: 4  // Use the actual WooCommerce connection
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${prokipConfig.token}`
      }
    });
    
    console.log('✅ Product push response:', pushResponse.data);
    
    // Check if products were actually created in WooCommerce
    if (pushResponse.data.success) {
      console.log('\n🎉 SUCCESS! Products were pushed to WooCommerce');
      console.log(`📊 Results: ${pushResponse.data.message}`);
      
      // Show individual results
      pushResponse.data.results.forEach((result, index) => {
        const status = result.status === 'success' ? '✅' : '❌';
        console.log(`${status} Product ${index + 1}: ${result.sku} - ${result.status}`);
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
      });
    } else {
      console.log('❌ Product push failed:', pushResponse.data);
    }
    
  } catch (error) {
    console.error('❌ Final test failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testFinalProductPush();
