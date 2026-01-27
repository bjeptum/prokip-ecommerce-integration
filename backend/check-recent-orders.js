const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRecentOrders() {
  try {
    console.log('🔍 Checking recent WooCommerce orders...');
    
    // Get recent sales logs
    const recentLogs = await prisma.salesLog.findMany({
      where: {
        orderDate: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { orderDate: 'desc' },
      take: 10
    });
    
    console.log(`📊 Found ${recentLogs.length} recent sales logs:`);
    recentLogs.forEach(log => {
      console.log(`  - Order ${log.orderNumber} (${log.orderId}) from ${log.orderDate.toISOString()}`);
    });
    
    // Check inventory logs
    const inventoryLogs = await prisma.inventoryLog.findMany({
      orderBy: { lastSynced: 'desc' },
      take: 5
    });
    
    console.log(`📦 Found ${inventoryLogs.length} inventory logs:`);
    inventoryLogs.forEach(log => {
      console.log(`  - SKU ${log.sku}: ${log.quantity} units (last synced: ${log.lastSynced?.toISOString()})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecentOrders();
