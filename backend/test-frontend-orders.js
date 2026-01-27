const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testFrontendOrders() {
  try {
    console.log('🔍 Testing frontend orders endpoint...');
    
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
    
    // Test frontend orders endpoint
    console.log('\n📋 Testing /stores/my-store/orders?connectionId=5...');
    const ordersResponse = await axios.get('http://localhost:3000/stores/my-store/orders?connectionId=5', {
      headers
    });
    
    console.log(`Response status: ${ordersResponse.status}`);
    console.log(`Orders found: ${ordersResponse.data.orders?.length || 0}`);
    
    if (ordersResponse.data.orders && ordersResponse.data.orders.length > 0) {
      console.log('\n🎉 SUCCESS! Frontend orders endpoint is working:');
      ordersResponse.data.orders.slice(0, 3).forEach((order, index) => {
        console.log(`${index + 1}. Order #${order.orderId || order.id} - ${order.total || order.total_price} - ${order.status || order.financial_status}`);
      });
    } else {
      console.log('\n❌ Frontend orders endpoint returns 0 orders');
      console.log('This means the frontend orders endpoint is not working properly');
    }
    
    // Check backend logs to see what's happening
    console.log('\n🔍 Checking backend authentication strategies...');
    console.log('The issue might be:');
    console.log('1. fetchWooCommerceOrders is failing silently');
    console.log('2. Authentication is failing in frontend endpoint');
    console.log('3. Orders are being filtered out incorrectly');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testFrontendOrders();
