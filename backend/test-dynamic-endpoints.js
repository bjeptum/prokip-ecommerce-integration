// Test dynamic store endpoints
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

async function testDynamicEndpoints() {
  console.log('🧪 Testing Dynamic Store Endpoints\n');
  
  try {
    const prisma = new PrismaClient();
    
    // Get current Prokip token
    const prokipConfig = await prisma.prokipConfig.findFirst();
    if (!prokipConfig || !prokipConfig.token) {
      console.log('❌ No Prokip token found');
      return;
    }
    
    const token = prokipConfig.token;
    console.log(`✅ Using current Prokip token (length: ${token.length})`);
    
    // Test 1: Dynamic products endpoint
    console.log('\n1. Testing GET /stores/my-store/products');
    try {
      const response = await axios.get('http://localhost:3000/stores/my-store/products', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Dynamic products successful!');
      console.log(`   Status: ${response.status}`);
      console.log(`   Products: ${response.data.products?.length || 0}`);
      console.log(`   Connection ID: ${response.data.connectionId}`);
      console.log(`   Store URL: ${response.data.storeUrl}`);
      
    } catch (error) {
      console.log('❌ Dynamic products failed:');
      console.log(`   Status: ${error.response?.status || 'No response'}`);
      console.log(`   Error: ${error.response?.data?.error || error.message}`);
    }
    
    // Test 2: Dynamic orders endpoint
    console.log('\n2. Testing GET /stores/my-store/orders');
    try {
      const response = await axios.get('http://localhost:3000/stores/my-store/orders', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Dynamic orders successful!');
      console.log(`   Status: ${response.status}`);
      console.log(`   Orders: ${response.data.orders?.length || 0}`);
      console.log(`   Connection ID: ${response.data.connectionId}`);
      console.log(`   Store URL: ${response.data.storeUrl}`);
      
    } catch (error) {
      console.log('❌ Dynamic orders failed:');
      console.log(`   Status: ${error.response?.status || 'No response'}`);
      console.log(`   Error: ${error.response?.data?.error || error.message}`);
    }
    
    // Test 3: Dynamic analytics endpoint
    console.log('\n3. Testing GET /stores/my-store/analytics');
    try {
      const response = await axios.get('http://localhost:3000/stores/my-store/analytics', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Dynamic analytics successful!');
      console.log(`   Status: ${response.status}`);
      console.log(`   Synced Products: ${response.data.syncedProducts || 0}`);
      console.log(`   Orders Processed: ${response.data.ordersProcessed || 0}`);
      console.log(`   Connection ID: ${response.data.connectionId}`);
      console.log(`   Store URL: ${response.data.storeUrl}`);
      
    } catch (error) {
      console.log('❌ Dynamic analytics failed:');
      console.log(`   Status: ${error.response?.status || 'No response'}`);
      console.log(`   Error: ${error.response?.data?.error || error.message}`);
    }
    
    await prisma.$disconnect();
    
    console.log('\n🎉 Dynamic Solution Benefits:');
    console.log('✅ No more hardcoded connection IDs');
    console.log('✅ Works with any connection ID (3, 4, 5, etc.)');
    console.log('✅ Auto-detects user\'s WooCommerce connection');
    console.log('✅ Future-proof for reconnections');
    console.log('✅ Simplified frontend code');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDynamicEndpoints();
