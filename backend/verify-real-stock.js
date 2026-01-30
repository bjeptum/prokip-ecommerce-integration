/**
 * REAL STOCK VERIFICATION: Check actual stock levels in Prokip
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyRealStock() {
  console.log('🔍 REAL STOCK VERIFICATION: Checking Actual Prokip Stock Levels');
  console.log('=' .repeat(80));

  try {
    // 1. Get recent sales that supposedly reduced stock
    console.log('\n📋 1. Recent Stock Reduction Attempts');
    
    const recentSales = await prisma.salesLog.findMany({
      where: { stockDeducted: true },
      orderBy: { syncedAt: 'desc' },
      take: 5,
      include: {
        connection: true
      }
    });

    console.log(`   Found ${recentSales.length} recent stock deductions:`);
    
    recentSales.forEach((sale, index) => {
      console.log(`   Sale ${index + 1}: Order ${sale.orderId}`);
      console.log(`     Synced At: ${sale.syncedAt}`);
      console.log(`     Stock Deducted: ${sale.stockDeducted ? '✅' : '❌'}`);
      console.log(`     Deduction Date: ${sale.stockDeductionDate || 'N/A'}`);
    });

    // 2. Check actual stock levels in Prokip
    console.log('\n📋 2. Actual Stock Levels in Prokip');
    
    const prokipService = require('./src/services/prokipService');
    const prokipConfigs = await prisma.prokipConfig.findMany();
    
    if (prokipConfigs.length === 0) {
      console.log('   ❌ No Prokip configurations found');
      return;
    }

    const config = prokipConfigs[0];
    console.log(`   User ID: ${config.userId}, Location: ${config.locationId}`);
    
    // Get current products from Prokip
    const products = await prokipService.getProducts(config.locationId, config.userId);
    console.log(`   Total products in Prokip: ${products.length}`);
    
    // Find the test product we've been using
    const testProduct = products.find(p => p.sku === '4744942');
    
    if (testProduct) {
      console.log(`   \n   Test Product Found:`);
      console.log(`     Name: ${testProduct.name}`);
      console.log(`     SKU: ${testProduct.sku}`);
      console.log(`     Current Stock: ${testProduct.stock || testProduct.qty_available || 'N/A'}`);
      console.log(`     Enable Stock: ${testProduct.enable_stock}`);
      console.log(`     Alert Quantity: ${testProduct.alert_quantity}`);
      
      // Check if stock tracking is enabled
      if (testProduct.enable_stock === 1) {
        console.log(`     ✅ Stock tracking is ENABLED`);
      } else {
        console.log(`     ❌ Stock tracking is DISABLED - This is the problem!`);
      }
    } else {
      console.log(`   ❌ Test product (SKU: 4744942) not found in Prokip`);
    }

    // 3. Check recent sales records in Prokip
    console.log('\n📋 3. Recent Sales Records in Prokip');
    
    try {
      const sales = await prokipService.getSales(config.locationId, config.userId);
      console.log(`   Recent sales in Prokip: ${sales.length}`);
      
      // Look for our test sales
      const testSales = sales.filter(sale => 
        sale.invoice_no && (
          sale.invoice_no.includes('WEBHOOK-TEST') || 
          sale.invoice_no.includes('AUTO-TEST') ||
          sale.invoice_no.includes('MULTI-TEST')
        )
      );
      
      console.log(`   Test sales found: ${testSales.length}`);
      
      testSales.forEach((sale, index) => {
        console.log(`   Test Sale ${index + 1}:`);
        console.log(`     Invoice: ${sale.invoice_no}`);
        console.log(`     Date: ${sale.transaction_date}`);
        console.log(`     Total: ${sale.final_total}`);
        
        if (sale.sell_lines && sale.sell_lines.length > 0) {
          sale.sell_lines.forEach((line, lineIndex) => {
            console.log(`     Product ${lineIndex + 1}: ${line.product_name} (Qty: ${line.quantity})`);
          });
        }
      });
      
    } catch (salesError) {
      console.log(`   ❌ Could not fetch sales: ${salesError.message}`);
    }

    // 4. Test manual stock reduction to verify it actually works
    console.log('\n📋 4. Manual Stock Reduction Test');
    
    if (testProduct) {
      const originalStock = parseInt(testProduct.stock || testProduct.qty_available || 0);
      console.log(`   Original stock: ${originalStock}`);
      
      try {
        console.log(`   Testing manual stock reduction for SKU: ${testProduct.sku}`);
        
        const result = await prokipService.deductStockFromProkip(
          [{ productId: testProduct.sku, product_id: testProduct.sku, quantity: 1 }],
          config.locationId,
          'Manual verification test',
          config.userId
        );
        
        if (result.success) {
          console.log(`   ✅ Manual stock reduction successful`);
          console.log(`   Endpoint used: ${result.endpoint}`);
          
          // Wait a moment and check stock again
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const updatedProducts = await prokipService.getProducts(config.locationId, config.userId);
          const updatedProduct = updatedProducts.find(p => p.sku === testProduct.sku);
          
          if (updatedProduct) {
            const newStock = parseInt(updatedProduct.stock || updatedProduct.qty_available || 0);
            console.log(`   New stock: ${newStock}`);
            
            if (newStock < originalStock) {
              console.log(`   ✅ Stock actually reduced in Prokip!`);
              console.log(`   Reduction: ${originalStock - newStock} units`);
            } else {
              console.log(`   ❌ Stock did NOT change in Prokip`);
              console.log(`   This indicates a problem with the stock reduction API`);
            }
          }
        } else {
          console.log(`   ❌ Manual stock reduction failed: ${result.error}`);
        }
        
      } catch (manualError) {
        console.log(`   ❌ Manual test error: ${manualError.message}`);
      }
    }

    // 5. Check if there's a stock sync issue
    console.log('\n📋 5. Stock Sync Analysis');
    
    console.log(`   Possible issues:`);
    console.log(`   1. Stock tracking disabled for products`);
    console.log(`   2. Stock reduction API not actually updating stock`);
    console.log(`   3. Different stock locations/warehouses`);
    console.log(`   4. Stock updates being cached or delayed`);
    console.log(`   5. Permission issues with stock modification`);

    // 6. Provide solution
    console.log('\n🎯 SOLUTION RECOMMENDATION:');
    
    if (testProduct && testProduct.enable_stock === 1) {
      console.log(`   ✅ Stock tracking is enabled`);
      console.log(`   💡 The issue might be with the stock reduction API endpoint`);
      console.log(`   💡 Need to verify which endpoint actually updates stock`);
    } else {
      console.log(`   ❌ Stock tracking is DISABLED`);
      console.log(`   💡 This is the root cause - enable stock tracking in Prokip`);
      console.log(`   💡 Go to Prokip → Products → Enable stock management`);
    }

  } catch (error) {
    console.error('\n❌ Stock verification failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the verification
if (require.main === module) {
  verifyRealStock()
    .then(() => {
      console.log('\n✨ Real stock verification completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Verification crashed:', error);
      process.exit(1);
    });
}

module.exports = { verifyRealStock };
