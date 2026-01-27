const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testAuth() {
  try {
    console.log('Checking Prokip configuration...');
    
    // Get Prokip config
    const prokipConfig = await prisma.prokipConfig.findFirst();
    console.log('Prokip config:', prokipConfig);
    
    if (prokipConfig?.token) {
      console.log('Testing with Prokip token...');
      
      // Test product push with Prokip token
      const pushResponse = await axios.post('http://localhost:3000/setup/products', {
        method: 'push',
        connectionId: 4  // Use the actual connection ID
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${prokipConfig.token}`
        }
      });
      
      console.log('Product push successful:', pushResponse.data);
    } else {
      console.log('No Prokip token found');
    }
    
  } catch (error) {
    console.error('Auth test failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAuth();
