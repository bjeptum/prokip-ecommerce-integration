const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');

const prisma = new PrismaClient();

async function verifyProkipStockReduction() {
  console.log('🔍 Verifying Prokip Stock Reduction');
  console.log('====================================');

  try {
    // 1. Get current stock from Prokip
    console.log('\n1️⃣ Fetching current stock from Prokip...');
    const stockData = await prokipService.getInventory(null, 50);
    console.log(`✅ Found ${stockData.length} stock entries in Prokip`);

    // 2. Check specific SKUs from our test
    const testSkus = ['4848961', '4815445'];
    console.log('\n2️⃣ Checking specific SKUs from test order...');
    
    for (const sku of testSkus) {
      const prokipStock = stockData.find(item => item.sku === sku);
      const localLog = await prisma.inventoryLog.findFirst({
        where: { sku }
      });

      console.log(`\n📦 SKU ${sku}:`);
      console.log(`   Prokip Stock: ${prokipStock ? prokipStock.stock : 'Not found'}`);
      console.log(`   Local Cache: ${localLog ? localLog.quantity : 'Not found'}`);
      
      if (prokipStock && localLog) {
        const difference = parseInt(prokipStock.stock) - localLog.quantity;
        if (difference === 0) {
          console.log(`   ✅ Stock levels match`);
        } else {
          console.log(`   ⚠️ Stock difference: ${difference} units`);
        }
      }
    }

    // 3. Check recent sales in Prokip
    console.log('\n3️⃣ Checking recent sales in Prokip...');
    try {
      const sales = await prokipService.getSales(null, null, null, 50);
      console.log(`✅ Found ${sales.length} sales in Prokip`);
      
      // Show recent sales
      const recentSales = sales.slice(0, 5);
      recentSales.forEach(sale => {
        console.log(`   Sale ID: ${sale.id} | Invoice: ${sale.invoice_no} | Total: ${sale.final_total}`);
      });
    } catch (error) {
      console.log('⚠️ Could not fetch sales from Prokip:', error.message);
    }

    // 4. Verify our test sale was processed
    console.log('\n4️⃣ Verifying test sale processing...');
    const testSale = await prisma.salesLog.findFirst({
      where: { orderId: '14250' }
    });

    if (testSale) {
      console.log(`✅ Test sale found in database`);
      console.log(`   Order ID: ${testSale.orderId}`);
      console.log(`   Invoice: ${testSale.invoiceNo}`);
      console.log(`   Prokip ID: ${testSale.prokipSellId || 'Not returned'}`);
      console.log(`   Stock Deducted: ${testSale.stockDeducted}`);
      console.log(`   Created: ${testSale.syncedAt}`);
    } else {
      console.log('❌ Test sale not found in database');
    }

    console.log('\n✅ Stock verification completed!');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifyProkipStockReduction();
