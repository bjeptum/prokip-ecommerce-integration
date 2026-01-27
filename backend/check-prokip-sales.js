const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function checkProkipSales() {
  try {
    console.log('🔍 Checking Prokip sales for recent transactions...');
    
    // Get Prokip config
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });
    
    if (!prokipConfig?.token) {
      console.log('❌ No Prokip config found');
      return;
    }
    
    console.log('✅ Prokip config found');
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };
    
    // Check recent sales in Prokip
    console.log('\n🔍 Checking recent Prokip sales...');
    try {
      const salesResponse = await axios.get('https://api.prokip.africa/connector/api/sales?per_page=20', { headers });
      const recentSales = salesResponse.data;
      
      console.log(`Found ${recentSales.length} recent sales in Prokip:`);
      
      let foundOurSale = false;
      recentSales.forEach((sale, index) => {
        console.log(`${index + 1}. Sale ID: ${sale.id} - Amount: ${sale.total_amount} - Reference: ${sale.reference_number || 'N/A'} - Date: ${sale.created_at}`);
        
        // Check if this matches our WooCommerce order
        if (sale.reference_number === '14148') {
          console.log(`   ✅ This matches our WooCommerce order #14148!`);
          foundOurSale = true;
        }
      });
      
      if (!foundOurSale) {
        console.log('\n❌ Order #14148 sale NOT found in Prokip sales');
        console.log('This means the stock deduction did NOT happen in Prokip');
      } else {
        console.log('\n✅ Order #14148 sale WAS found in Prokip!');
        console.log('This means the stock deduction DID happen');
      }
      
    } catch (error) {
      console.log('❌ Could not fetch Prokip sales:', error.message);
      console.log('Error details:', error.response?.data || 'No details available');
    }
    
    // Also check our local sales log
    console.log('\n📋 Local sales log entries:');
    const salesLog = await prisma.salesLog.findMany({
      where: {
        connectionId: 5
      },
      orderBy: { syncedAt: 'desc' },
      take: 5
    });
    
    console.log(`Found ${salesLog.length} sales log entries:`);
    salesLog.forEach((sale, index) => {
      console.log(`${index + 1}. Order #${sale.orderId} - ${sale.totalAmount} - ${sale.status} - ${sale.syncedAt}`);
    });
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkProkipSales();
