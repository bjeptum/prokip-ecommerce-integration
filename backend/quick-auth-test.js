/**
 * Quick authentication test
 */

const axios = require('axios');
const prisma = require('./src/lib/prisma');

async function quickAuthTest() {
  try {
    console.log('🔧 Quick authentication test...\n');
    
    // Test health endpoint first
    const healthResponse = await axios.get('http://localhost:3000/health');
    console.log('✅ Health check:', healthResponse.data.status);
    
    // Get Prokip token
    const prokipConfig = await prisma.prokipConfig.findFirst({ 
      where: { userId: 50 } 
    });
    
    if (!prokipConfig?.token) {
      throw new Error('No Prokip token found');
    }
    
    console.log('✅ Prokip token loaded');
    
    // Test setup/products endpoint specifically
    console.log('\n🧪 Testing setup/products endpoint...');
    
    const response = await axios.post('http://localhost:3000/setup/products', 
      { method: 'push', connectionId: 10 },
      {
        headers: {
          'Authorization': `Bearer ${prokipConfig.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }
    );
    
    console.log('✅ Setup Products: SUCCESS!');
    console.log('Response:', response.data);
    
  } catch (error) {
    console.error('❌ Test failed:');
    console.error('   Status:', error.response?.status);
    console.error('   Data:', error.response?.data);
    console.error('   Message:', error.message);
  }
}

quickAuthTest();
