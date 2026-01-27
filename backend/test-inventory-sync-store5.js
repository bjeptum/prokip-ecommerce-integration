const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testInventorySyncStore5() {
  try {
    console.log('🔄 Testing inventory sync for Store 5...');
    
    // Get Prokip config for authentication
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });
    
    if (!prokipConfig?.token) {
      console.log('No Prokip config found');
      return;
    }
    
    // Test inventory sync endpoint with connectionId 5
    const response = await axios.post('http://localhost:3000/sync/inventory', {
      connectionId: 5
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${prokipConfig.token}`
      }
    });
    
    console.log('✅ Inventory sync response:', response.data);
    
  } catch (error) {
    console.error('❌ Inventory sync test failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testInventorySyncStore5();
