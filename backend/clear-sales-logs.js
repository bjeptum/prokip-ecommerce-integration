const prisma = require('./src/lib/prisma');

async function checkAndClearSalesLogs() {
  try {
    console.log('🧪 Checking sales logs for recent orders...');
    
    // Check if order #14223 is already processed
    const existingLog = await prisma.salesLog.findFirst({
      where: {
        connectionId: 1,
        orderId: '14223'
      }
    });
    
    if (existingLog) {
      console.log('❌ Order #14223 already processed - this is why it\'s being skipped');
      console.log('📝 Sales log details:', {
        id: existingLog.id,
        orderId: existingLog.orderId,
        orderNumber: existingLog.orderNumber,
        status: existingLog.status,
        orderDate: existingLog.orderDate,
        stockDeducted: existingLog.stockDeducted
      });
      
      // Option 1: Delete the sales log to re-process the order
      console.log('\n🔧 Deleting sales log to re-process order...');
      await prisma.salesLog.delete({
        where: { id: existingLog.id }
      });
      console.log('✅ Sales log deleted - order will be processed again');
      
    } else {
      console.log('✅ Order #14223 not found in sales logs - should be processed');
    }
    
    // Show all recent sales logs
    console.log('\n📊 All sales logs for connection 1:');
    const allLogs = await prisma.salesLog.findMany({
      where: { connectionId: 1 },
      orderBy: { orderDate: 'desc' },
      take: 10
    });
    
    allLogs.forEach((log, index) => {
      console.log(`${index + 1}. Order #${log.orderId} - ${log.status} - ${log.orderDate} - Stock deducted: ${log.stockDeducted}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndClearSalesLogs();
