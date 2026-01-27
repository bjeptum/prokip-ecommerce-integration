const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkSalesLog() {
  try {
    console.log('📋 Checking sales log for WooCommerce orders...');
    
    // Check sales log entries
    const salesLog = await prisma.salesLog.findMany({
      where: {
        connectionId: 5 // Store 5
      },
      orderBy: { syncedAt: 'desc' },
      take: 10
    });
    
    console.log(`Found ${salesLog.length} sales log entries for Store 5`);
    
    if (salesLog.length > 0) {
      console.log('\n📈 Recent sales:');
      salesLog.forEach((sale, index) => {
        console.log(`${index + 1}. Order #${sale.orderId} - ${sale.totalAmount} - ${sale.status} - ${sale.syncedAt}`);
      });
    } else {
      console.log('❌ No sales log entries found for Store 5');
      console.log('This means WooCommerce orders are not being processed for stock deduction');
    }
    
    // Check inventory log to see current stock levels
    console.log('\n📦 Checking inventory log...');
    const inventoryLog = await prisma.inventoryLog.findMany({
      where: {
        connectionId: 5
      },
      orderBy: { lastSynced: 'desc' },
      take: 5
    });
    
    console.log(`Found ${inventoryLog.length} inventory log entries for Store 5`);
    
    if (inventoryLog.length > 0) {
      console.log('\n📊 Recent inventory:');
      inventoryLog.forEach((item, index) => {
        console.log(`${index + 1}. ${item.productName} (SKU: ${item.sku}) - Stock: ${item.quantity} - Last synced: ${item.lastSynced}`);
      });
    }
    
    // Check if there are any sync errors
    console.log('\n❌ Checking sync errors...');
    const syncErrors = await prisma.syncError.findMany({
      where: {
        connectionId: 5
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    if (syncErrors.length > 0) {
      console.log(`Found ${syncErrors.length} sync errors:`);
      syncErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.errorType}: ${error.errorMessage} - Order: ${error.orderId}`);
      });
    } else {
      console.log('✅ No sync errors found');
    }
    
    console.log('\n🔍 Analysis:');
    console.log('If sales log is empty, the issue is:');
    console.log('1. Orders are not being processed by processStoreToProkip');
    console.log('2. Order payment status check is failing');
    console.log('3. Duplicate order check is preventing processing');
    console.log('4. Order mapping to Prokip format is failing');
    console.log('5. Prokip API calls are failing');
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSalesLog();
