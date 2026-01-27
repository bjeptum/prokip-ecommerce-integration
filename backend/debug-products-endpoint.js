const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function debugProductsEndpoint() {
  try {
    console.log('🔍 Debugging products endpoint for Store 5...');
    
    // Get Prokip config for authentication
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });
    
    if (!prokipConfig?.token) {
      console.log('No Prokip config found');
      return;
    }
    
    // Test the exact same request as frontend
    const response = await axios.get('http://localhost:3000/stores/my-store/products?connectionId=5', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${prokipConfig.token}`
      }
    });
    
    console.log('✅ Products endpoint response:');
    console.log('Status:', response.status);
    console.log('Data type:', typeof response.data);
    console.log('Is array?', Array.isArray(response.data));
    
    if (Array.isArray(response.data)) {
      console.log('✅ Response is an array with', response.data.length, 'products');
    } else if (response.data && typeof response.data === 'object') {
      console.log('📋 Response is an object with keys:', Object.keys(response.data));
      if (response.data.products) {
        console.log('✅ Found products array with', response.data.products.length, 'items');
      }
    }
    
    // Show first product structure
    const products = Array.isArray(response.data) ? response.data : response.data.products;
    if (products && products.length > 0) {
      console.log('\n📦 First product structure:');
      console.log(JSON.stringify(products[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugProductsEndpoint();
