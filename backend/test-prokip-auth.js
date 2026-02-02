/**
 * Test just the Prokip token authentication
 */

const axios = require('axios');
const prisma = require('./src/lib/prisma');

async function testProkipTokenOnly() {
  try {
    console.log('🔍 Testing Prokip token authentication only...\n');
    
    // Get the Prokip token
    const prokipConfig = await prisma.prokipConfig.findFirst({ 
      where: { userId: 50 } 
    });
    
    if (!prokipConfig || !prokipConfig.token) {
      throw new Error('No Prokip token found');
    }
    
    console.log('✅ Prokip token found:');
    console.log('   Length:', prokipConfig.token.length);
    console.log('   Starts with:', prokipConfig.token.substring(0, 50) + '...');
    
    // Test the inventory sync with this token
    console.log('\n🔄 Testing inventory sync with Prokip token...');
    
    const response = await axios.post('http://localhost:3000/sync/inventory', 
      { connectionId: 10 },
      {
        headers: {
          'Authorization': `Bearer ${prokipConfig.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    console.log('✅ SUCCESS! Inventory sync completed!');
    console.log('Response:', response.data);
    
  } catch (error) {
    console.error('❌ Test failed:');
    console.error('   Status:', error.response?.status);
    console.error('   Data:', error.response?.data);
    console.error('   Message:', error.message);
  }
}

testProkipTokenOnly();
