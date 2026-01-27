const axios = require('axios');

async function testEndpoints() {
  try {
    // Get the Prokip token from the database
    const {PrismaClient} = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const config = await prisma.prokipConfig.findFirst();
    if (!config) {
      console.log('❌ No Prokip config found');
      await prisma.$disconnect();
      return;
    }
    const token = config.token;
    
    console.log('Testing with token:', token.substring(0, 50) + '...');
    
    // Test products endpoint
    console.log('\n📦 Testing /stores/my-store/products...');
    try {
      const productsResponse = await axios.get('http://localhost:3000/stores/my-store/products', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('✅ Products successful:', productsResponse.data.products?.length || 0, 'products');
    } catch (error) {
      console.log('❌ Products failed:', error.response?.data || error.message);
    }
    
    // Test orders endpoint
    console.log('\n💰 Testing /stores/my-store/orders...');
    try {
      const ordersResponse = await axios.get('http://localhost:3000/stores/my-store/orders', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('✅ Orders successful:', ordersResponse.data.orders?.length || 0, 'orders');
    } catch (error) {
      console.log('❌ Orders failed:', error.response?.data || error.message);
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testEndpoints();
