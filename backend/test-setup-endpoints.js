// Test setup endpoints with correct methods
const axios = require('axios');

async function testSetupEndpoints() {
  console.log('🧪 Testing Setup Endpoints with Correct Methods\n');
  
  try {
    // Get Prokip token from database
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const prokipConfig = await prisma.prokipConfig.findFirst();
    if (!prokipConfig || !prokipConfig.token) {
      console.log('❌ No Prokip token found');
      return;
    }
    
    const token = prokipConfig.token;
    console.log(`✅ Using Prokip token (length: ${token.length})`);
    
    // Test 1: readiness-check (POST)
    console.log('\n1. Testing POST /setup/products/readiness-check');
    try {
      const response = await axios.post('http://localhost:3000/setup/products/readiness-check', 
        { connectionId: 3 },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ readiness-check successful!');
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(response.data).substring(0, 200)}...`);
      
    } catch (error) {
      console.log('❌ readiness-check failed:');
      console.log(`   Status: ${error.response?.status || 'No response'}`);
      console.log(`   Error: ${error.response?.data?.error || error.message}`);
    }
    
    // Test 2: products/matches (GET)
    console.log('\n2. Testing GET /setup/products/matches?connectionId=3');
    try {
      const response = await axios.get('http://localhost:3000/setup/products/matches', {
        params: { connectionId: 3 },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ products/matches successful!');
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(response.data).substring(0, 200)}...`);
      
    } catch (error) {
      console.log('❌ products/matches failed:');
      console.log(`   Status: ${error.response?.status || 'No response'}`);
      console.log(`   Error: ${error.response?.data?.error || error.message}`);
    }
    
    // Test 3: products (GET)
    console.log('\n3. Testing GET /setup/products');
    try {
      const response = await axios.get('http://localhost:3000/setup/products', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ products successful!');
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(response.data).substring(0, 200)}...`);
      
    } catch (error) {
      console.log('❌ products failed:');
      console.log(`   Status: ${error.response?.status || 'No response'}`);
      console.log(`   Error: ${error.response?.data?.error || error.message}`);
    }
    
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSetupEndpoints();
