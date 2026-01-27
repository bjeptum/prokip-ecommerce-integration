const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testOrderProcessing() {
  try {
    console.log('🔄 Testing order processing with detailed logs...');
    
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
    
    // Trigger order sync to see detailed processing logs
    console.log('\n🔄 Triggering order sync...');
    const syncResponse = await axios.post('http://localhost:3000/sync/pull-sales', {
      connectionId: 5
    }, {
      headers
    });
    
    console.log(`Sync result: ${syncResponse.data.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Orders processed: ${syncResponse.data.ordersProcessed || 0}`);
    
    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check sales log again
    console.log('\n📋 Checking sales log after processing...');
    const salesLog = await prisma.salesLog.findMany({
      where: {
        connectionId: 5
      },
      orderBy: { syncedAt: 'desc' },
      take: 10
    });
    
    console.log(`Sales log entries after processing: ${salesLog.length}`);
    
    if (salesLog.length > 0) {
      console.log('✅ SUCCESS! Sales were created:');
      salesLog.forEach((sale, index) => {
        console.log(`${index + 1}. Order #${sale.orderId} - ${sale.totalAmount} - ${sale.status}`);
      });
    } else {
      console.log('❌ Still no sales entries - check backend logs for processing details');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testOrderProcessing();
