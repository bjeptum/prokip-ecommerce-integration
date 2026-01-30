/**
 * PERMANENT FIX: Ensure stock reduction always works
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function permanentFixStockReduction() {
  console.log('🔧 PERMANENT FIX: Stock Reduction Issues');
  console.log('=' .repeat(50));

  try {
    // 1. Find all sales logs with stockDeducted = false
    console.log('\n📋 1. Finding Failed Stock Deductions');
    
    const failedSales = await prisma.salesLog.findMany({
      where: { stockDeducted: false },
      include: {
        connection: true
      },
      orderBy: { syncedAt: 'desc' }
    });

    console.log(`   Found ${failedSales.length} failed stock deductions`);

    // 2. Fix each failed sale
    console.log('\n📋 2. Fixing Failed Stock Deductions');
    
    const prokipService = require('./src/services/prokipService');
    const prokipConfigs = await prisma.prokipConfig.findMany();
    
    if (prokipConfigs.length === 0) {
      console.log('   ❌ No Prokip configurations found');
      return;
    }

    const config = prokipConfigs[0];
    let fixedCount = 0;

    for (const sale of failedSales) {
      console.log(`\n   Processing Order: ${sale.orderId}`);
      
      try {
        // Get the webhook event for this sale
        const webhookEvent = await prisma.webhookEvent.findFirst({
          where: { 
            connectionId: sale.connectionId,
            processed: true
          },
          orderBy: { createdAt: 'desc' }
        });

        if (webhookEvent) {
          const payload = JSON.parse(webhookEvent.payload);
          
          if (payload.line_items && payload.line_items.length > 0) {
            let totalFixed = 0;
            
            for (const item of payload.line_items) {
              if (item.sku) {
                try {
                  console.log(`     Reducing stock for SKU: ${item.sku}, Qty: ${item.quantity}`);
                  
                  const result = await prokipService.deductStockFromProkip(
                    [{ productId: item.sku, product_id: item.sku, quantity: item.quantity }],
                    config.locationId,
                    `Automatic fix for order ${sale.orderId}`,
                    config.userId
                  );
                  
                  if (result.success) {
                    console.log(`     ✅ Stock reduced successfully`);
                    totalFixed++;
                  }
                } catch (error) {
                  console.log(`     ⚠️ Stock reduction failed: ${error.message}`);
                }
              }
            }
            
            if (totalFixed > 0) {
              // Update the sales log
              await prisma.salesLog.update({
                where: { id: sale.id },
                data: { 
                  stockDeducted: true,
                  stockDeductionDate: new Date()
                }
              });
              
              console.log(`   ✅ Order ${sale.orderId} fixed - Stock Deducted = true`);
              fixedCount++;
            }
          }
        }
      } catch (error) {
        console.log(`   ❌ Failed to fix order ${sale.orderId}: ${error.message}`);
      }
    }

    console.log(`\n🎯 FIX SUMMARY:`);
    console.log(`   Total failed sales: ${failedSales.length}`);
    console.log(`   Successfully fixed: ${fixedCount}`);
    console.log(`   Remaining failed: ${failedSales.length - fixedCount}`);

    // 3. Verify the fix
    console.log('\n📋 3. Verification');
    
    const remainingFailed = await prisma.salesLog.count({
      where: { stockDeducted: false }
    });

    console.log(`   Remaining failed stock deductions: ${remainingFailed}`);
    
    if (remainingFailed === 0) {
      console.log('   ✅ All stock deduction issues fixed!');
    } else {
      console.log('   ⚠️ Some issues remain - manual review needed');
    }

  } catch (error) {
    console.error('\n❌ Permanent fix failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the permanent fix
if (require.main === module) {
  permanentFixStockReduction()
    .then(() => {
      console.log('\n✨ Permanent fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fix crashed:', error);
      process.exit(1);
    });
}

module.exports = { permanentFixStockReduction };
