const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testMultiStore() {
  try {
    console.log('🔄 Testing multi-store functionality...');
    
    // Get Prokip config for authentication
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });
    
    if (!prokipConfig?.token) {
      console.log('No Prokip config found');
      return;
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`
    };
    
    // Test Store 4 (first store)
    console.log('\n🏪 Testing Store 4 (prowebfunnels.com/kenditrades/):');
    try {
      const response4 = await axios.get('http://localhost:3000/stores/my-store/products?connectionId=4', {
        headers
      });
      console.log(`✅ Store 4: ${response4.data.products?.length || 0} products`);
      console.log(`📦 Sample: ${response4.data.products?.[0]?.name || 'N/A'}`);
    } catch (error) {
      console.log(`❌ Store 4 failed: ${error.response?.data?.error || error.message}`);
    }
    
    // Test Store 5 (second store)
    console.log('\n🏪 Testing Store 5 (learn.prokip.africa/):');
    try {
      const response5 = await axios.get('http://localhost:3000/stores/my-store/products?connectionId=5', {
        headers
      });
      console.log(`✅ Store 5: ${response5.data.products?.length || 0} products`);
      console.log(`📦 Sample: ${response5.data.products?.[0]?.name || 'N/A'}`);
    } catch (error) {
      console.log(`❌ Store 5 failed: ${error.response?.data?.error || error.message}`);
    }
    
    // Test orders for both stores
    console.log('\n💰 Testing orders for both stores:');
    
    try {
      const orders4 = await axios.get('http://localhost:3000/stores/my-store/orders?connectionId=4', {
        headers
      });
      console.log(`✅ Store 4 orders: ${orders4.data.orders?.length || 0}`);
    } catch (error) {
      console.log(`❌ Store 4 orders failed: ${error.response?.data?.error || error.message}`);
    }
    
    try {
      const orders5 = await axios.get('http://localhost:3000/stores/my-store/orders?connectionId=5', {
        headers
      });
      console.log(`✅ Store 5 orders: ${orders5.data.orders?.length || 0}`);
    } catch (error) {
      console.log(`❌ Store 5 orders failed: ${error.response?.data?.error || error.message}`);
    }
    
    console.log('\n🎉 Multi-store test complete!');
    
  } catch (error) {
    console.error('❌ Multi-store test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testMultiStore();
