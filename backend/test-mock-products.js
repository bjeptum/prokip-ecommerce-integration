const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

// Mock product data for testing
const mockProducts = [
  {
    id: '1',
    name: 'Test Product 1',
    sku: 'TEST001',
    product_variations: [{
      variations: [{
        sell_price_inc_tax: 29.99
      }]
    }]
  },
  {
    id: '2', 
    name: 'Test Product 2',
    sku: 'TEST002',
    product_variations: [{
      variations: [{
        sell_price_inc_tax: 49.99
      }]
    }]
  }
];

async function testProductPushWithMockData() {
  try {
    console.log('Testing product push with mock data...');
    
    // Get Prokip config for authentication
    const prokipConfig = await prisma.prokipConfig.findFirst();
    if (!prokipConfig?.token) {
      console.log('No Prokip token found');
      return;
    }
    
    console.log('Using Prokip token for authentication...');
    
    // Test the product push endpoint with a mock request
    // We'll modify the setupRoutes temporarily to use mock data
    const pushResponse = await axios.post('http://localhost:3000/setup/products', {
      method: 'push',
      connectionId: 4  // Use the actual WooCommerce connection
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${prokipConfig.token}`
      }
    });
    
    console.log('Product push response:', pushResponse.data);
    
  } catch (error) {
    console.error('Mock test failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testProductPushWithMockData();
