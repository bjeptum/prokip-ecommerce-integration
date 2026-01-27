const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkOrder14213() {
  try {
    console.log('🔍 Checking order #14213 processing...');
    
    // Check if order was processed
    const salesLog = await prisma.salesLog.findFirst({
      where: {
        orderId: '14213'
      }
    });
    
    if (salesLog) {
      console.log('✅ Order #14213 was processed:');
      console.log(`  - Sales Log ID: ${salesLog.id}`);
      console.log(`  - Order Number: ${salesLog.orderNumber}`);
      console.log(`  - Customer: ${salesLog.customerName}`);
      console.log(`  - Total: ${salesLog.totalAmount}`);
      console.log(`  - Status: ${salesLog.status}`);
      console.log(`  - Date: ${salesLog.orderDate.toISOString()}`);
    } else {
      console.log('❌ Order #14213 was not processed');
    }
    
    // Check inventory for the product
    console.log('\n📦 Checking inventory for SKU 4848961...');
    const inventoryLog = await prisma.inventoryLog.findFirst({
      where: {
        sku: '4848961'
      }
    });
    
    if (inventoryLog) {
      console.log(`  - Current stock: ${inventoryLog.quantity} units`);
      console.log(`  - Last synced: ${inventoryLog.lastSynced?.toISOString()}`);
    } else {
      console.log('  - No inventory log found');
    }
    
    // Check recent sales logs
    console.log('\n📋 Recent sales logs:');
    const recentLogs = await prisma.salesLog.findMany({
      orderBy: { orderDate: 'desc' },
      take: 5
    });
    
    recentLogs.forEach(log => {
      console.log(`  - Order ${log.orderNumber} (${log.orderId}) from ${log.orderDate.toISOString()}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrder14213();
