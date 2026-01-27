require('dotenv').config();
const axios = require('axios');

async function testApiResponse() {
  try {
    // Get a fresh token from the database
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const config = await prisma.prokipConfig.findFirst({ where: { userId: 50 } });
    const token = config.token;
    
    console.log('🧪 Testing API response format...');
    
    // Test products endpoint
    const productsResponse = await axios.get('http://localhost:3000/stores/my-store/products', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('📦 Products response:');
    console.log('   Status:', productsResponse.status);
    console.log('   Has products property:', 'products' in productsResponse.data);
    console.log('   Products array length:', productsResponse.data.products?.length || 'N/A');
    console.log('   Is array directly:', Array.isArray(productsResponse.data));
    console.log('   Response keys:', Object.keys(productsResponse.data));
    
    // Test orders endpoint
    const ordersResponse = await axios.get('http://localhost:3000/stores/my-store/orders', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('\n💰 Orders response:');
    console.log('   Status:', ordersResponse.status);
    console.log('   Has orders property:', 'orders' in ordersResponse.data);
    console.log('   Orders array length:', ordersResponse.data.orders?.length || 'N/A');
    console.log('   Is array directly:', Array.isArray(ordersResponse.data));
    console.log('   Response keys:', Object.keys(ordersResponse.data));
    
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.log('   Response status:', error.response.status);
      console.log('   Response data:', error.response.data);
    }
  }
}

testApiResponse();
