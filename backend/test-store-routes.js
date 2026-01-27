// Test store routes for products and orders
const axios = require('axios');

async function testStoreRoutes() {
  console.log('🧪 Testing Store Routes for Products and Orders\n');
  
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
    
    // Test 1: Store products
    console.log('\n1. Testing GET /stores/3/products');
    try {
      const response = await axios.get('http://localhost:3000/stores/3/products', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Store products successful!');
      console.log(`   Status: ${response.status}`);
      console.log(`   Products count: ${response.data.products?.length || 0}`);
      
    } catch (error) {
      console.log('❌ Store products failed:');
      console.log(`   Status: ${error.response?.status || 'No response'}`);
      console.log(`   Error: ${error.response?.data?.error || error.message}`);
    }
    
    // Test 2: Store orders
    console.log('\n2. Testing GET /stores/3/orders');
    try {
      const response = await axios.get('http://localhost:3000/stores/3/orders', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Store orders successful!');
      console.log(`   Status: ${response.status}`);
      console.log(`   Orders count: ${response.data.orders?.length || 0}`);
      
    } catch (error) {
      console.log('❌ Store orders failed:');
      console.log(`   Status: ${error.response?.status || 'No response'}`);
      console.log(`   Error: ${error.response?.data?.error || error.message}`);
    }
    
    // Test 3: Store analytics
    console.log('\n3. Testing GET /stores/3/analytics');
    try {
      const response = await axios.get('http://localhost:3000/stores/3/analytics', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Store analytics successful!');
      console.log(`   Status: ${response.status}`);
      console.log(`   Analytics: ${JSON.stringify(response.data).substring(0, 200)}...`);
      
    } catch (error) {
      console.log('❌ Store analytics failed:');
      console.log(`   Status: ${error.response?.status || 'No response'}`);
      console.log(`   Error: ${error.response?.data?.error || error.message}`);
    }
    
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testStoreRoutes();
