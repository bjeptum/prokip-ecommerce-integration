const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearInventoryLogs() {
  try {
    console.log('🧹 Clearing inventory logs...');
    
    // Delete all inventory log entries for the WooCommerce connection
    const deleteResult = await prisma.inventoryLog.deleteMany({
      where: {
        connectionId: 4 // WooCommerce connection ID
      }
    });
    
    console.log(`✅ Cleared ${deleteResult.count} inventory log entries`);
    
  } catch (error) {
    console.error('Failed to clear inventory logs:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

clearInventoryLogs();
