const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testInventorySync() {
  try {
    console.log('🔄 Testing inventory sync...');
    
    // Get Prokip config for authentication
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });
    
    if (!prokipConfig?.token) {
      console.log('No Prokip config found');
      return;
    }
    
    // Test inventory sync endpoint
    const response = await axios.post('http://localhost:3000/sync/inventory', {
      connectionId: 4
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

testInventorySync();
