const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSalesLogs() {
  try {
    console.log('🔍 Checking recent sales logs...');
    const logs = await prisma.salesLog.findMany({
      orderBy: { id: 'desc' },
      take: 10,
      include: { connection: true }
    });
    
    console.log('📊 Recent sales logs:');
    logs.forEach(log => {
      console.log(`   Order ${log.orderId}: ${log.platform} | Status: ${log.status} | Stock Deducted: ${log.stockDeducted} | Date: ${log.createdAt}`);
    });
    
    console.log('\n🔍 Checking inventory logs...');
    const inventoryLogs = await prisma.inventoryLog.findMany({
      orderBy: { id: 'desc' },
      take: 10,
      include: { connection: true }
    });
    
    console.log('📦 Recent inventory logs:');
    inventoryLogs.forEach(log => {
      console.log(`   SKU ${log.sku}: Qty ${log.quantity} | Last Synced: ${log.lastSynced}`);
    });
    
    console.log('\n🔍 Checking completed WooCommerce orders...');
    const connection = await prisma.connection.findFirst({
      where: { platform: 'woocommerce' }
    });
    
    if (connection) {
      console.log(`Found WooCommerce connection: ${connection.storeUrl}`);
      
      const recentLogs = await prisma.salesLog.findMany({
        where: { 
          connectionId: connection.id,
          platform: 'woocommerce',
          status: 'completed'
        },
        orderBy: { id: 'desc' },
        take: 5
      });
      
      console.log(`Found ${recentLogs.length} completed WooCommerce orders`);
      recentLogs.forEach(log => {
        console.log(`   Order ${log.orderId}: ${log.stockDeducted ? '✅ Stock deducted' : '❌ Stock NOT deducted'} | ${log.orderDate}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSalesLogs();
