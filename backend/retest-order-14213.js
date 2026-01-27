const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function retestOrder14213() {
  try {
    console.log('🔄 Retesting order #14213 with fixed logic...');
    
    // Delete the existing sales log
    const existingLog = await prisma.salesLog.findFirst({
      where: {
        orderId: '14213'
      }
    });
    
    if (existingLog) {
      await prisma.salesLog.delete({
        where: { id: existingLog.id }
      });
      console.log('✅ Deleted existing sales log');
    }
    
    // Get current inventory
    const inventoryLog = await prisma.inventoryLog.findFirst({
      where: {
        sku: '4848961'
      }
    });
    
    console.log(`📊 Current inventory: ${inventoryLog?.quantity || 0} units`);
    
    // Run the sync again
    console.log('\n🔄 Running bidirectional sync...');
    
    const response = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }
    });
    
    console.log('✅ Sync completed!');
    console.log('Results:', response.data.results);
    
    // Check inventory after sync
    const updatedInventory = await prisma.inventoryLog.findFirst({
      where: {
        sku: '4848961'
      }
    });
    
    console.log(`\n📊 Updated inventory: ${updatedInventory?.quantity || 0} units`);
    
    const stockChange = (updatedInventory?.quantity || 0) - (inventoryLog?.quantity || 0);
    console.log(`📈 Stock change: ${stockChange > 0 ? '+' : ''}${stockChange} units`);
    
    // Check if order was processed
    const newSalesLog = await prisma.salesLog.findFirst({
      where: {
        orderId: '14213'
      }
    });
    
    if (newSalesLog) {
      console.log(`✅ Order #14213 processed successfully`);
      console.log(`  - Sales Log ID: ${newSalesLog.id}`);
      console.log(`  - Processed at: ${newSalesLog.orderDate.toISOString()}`);
    } else {
      console.log(`❌ Order #14213 was not processed`);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Data:`, error.response.data);
    }
  } finally {
    await prisma.$disconnect();
  }
}

retestOrder14213();
