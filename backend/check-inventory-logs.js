const prisma = require('./src/lib/prisma');

async function checkInventoryLogs() {
  try {
    console.log('🧪 Checking inventory logs for the order products...');
    
    // Check inventory logs for the SKUs in the order
    const skus = ['4987009', '4935029']; // Martel Glue and Lapiere setting spray
    
    for (const sku of skus) {
      console.log(`\n📊 Checking inventory log for SKU ${sku}:`);
      const inventoryLog = await prisma.inventoryLog.findFirst({
        where: {
          connectionId: 1,
          sku: sku
        }
      });
      
      if (inventoryLog) {
        console.log(`✅ Found inventory log:`);
        console.log(`  - SKU: ${inventoryLog.sku}`);
        console.log(`  - Product Name: ${inventoryLog.productName}`);
        console.log(`  - Current Quantity: ${inventoryLog.quantity}`);
        console.log(`  - Price: ${inventoryLog.price}`);
        console.log(`  - Last Synced: ${inventoryLog.lastSynced}`);
      } else {
        console.log(`❌ No inventory log found for SKU ${sku}`);
        console.log('   This means no stock has been synced from Prokip for this product yet');
      }
    }
    
    // Check the most recent sales log
    console.log('\n📊 Checking most recent sales log:');
    const recentSalesLog = await prisma.salesLog.findFirst({
      where: { connectionId: 1 },
      orderBy: { orderDate: 'desc' }
    });
    
    if (recentSalesLog) {
      console.log(`✅ Recent sales log:`);
      console.log(`  - Order ID: ${recentSalesLog.orderId}`);
      console.log(`  - Order Number: ${recentSalesLog.orderNumber}`);
      console.log(`  - Status: ${recentSalesLog.status}`);
      console.log(`  - Total Amount: ${recentSalesLog.totalAmount}`);
      console.log(`  - Stock Deducted: ${recentSalesLog.stockDeducted}`);
      console.log(`  - Order Date: ${recentSalesLog.orderDate}`);
    } else {
      console.log('❌ No sales logs found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkInventoryLogs();
