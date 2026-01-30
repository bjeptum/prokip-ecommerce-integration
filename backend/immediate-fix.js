/**
 * IMMEDIATE FIX: Investigate and fix the recent failed stock deduction
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function immediateFix() {
  console.log('🚨 IMMEDIATE FIX: Recent Failed Stock Deduction');
  console.log('=' .repeat(60));

  try {
    // 1. Get the failed sales log
    console.log('\n📋 1. Failed Sale Details');
    
    const failedSale = await prisma.salesLog.findFirst({
      where: { 
        orderId: '14220',
        stockDeducted: false 
      },
      include: {
        connection: true
      }
    });

    if (!failedSale) {
      console.log('   ❌ No failed sale found for order 14220');
      return;
    }

    console.log(`   Order ID: ${failedSale.orderId}`);
    console.log(`   Platform: ${failedSale.platform}`);
    console.log(`   Total Amount: ${failedSale.totalAmount}`);
    console.log(`   Synced At: ${failedSale.syncedAt}`);
    console.log(`   Connection: ${failedSale.connection?.storeUrl}`);

    // 2. Check recent webhook events
    console.log('\n📋 2. Recent Webhook Events');
    
    const recentWebhooks = await prisma.webhookEvent.findMany({
      where: { 
        connectionId: failedSale.connectionId,
        processed: true
      },
      orderBy: { createdAt: 'desc' },
      take: 3
    });

    let targetWebhook = null;
    
    recentWebhooks.forEach((event, index) => {
      console.log(`   Event ${event.id}: ${event.eventType} - ${event.createdAt}`);
      
      try {
        const payload = JSON.parse(event.payload);
        console.log(`     Order ID: ${payload.id}`);
        console.log(`     Status: ${payload.status}`);
        
        if (payload.line_items && payload.line_items.length > 0) {
          payload.line_items.forEach((item, itemIndex) => {
            console.log(`     Item ${itemIndex + 1}: SKU ${item.sku || 'NO SKU'}, Qty ${item.quantity}`);
          });
        }
        
        // Check if this webhook corresponds to our failed sale
        if (payload.id === '14220' || payload.id === failedSale.orderId) {
          targetWebhook = event;
          console.log('     🎯 THIS IS THE TARGET WEBHOOK!');
        }
      } catch (parseError) {
        console.log('     Could not parse payload');
      }
    });

    // 3. Analyze the failure
    console.log('\n📋 3. Failure Analysis');
    
    if (targetWebhook) {
      try {
        const payload = JSON.parse(targetWebhook.payload);
        
        console.log(`   Order Status: ${payload.status}`);
        console.log(`   Customer: ${payload.customer?.first_name} ${payload.customer?.last_name}`);
        
        if (payload.line_items && payload.line_items.length > 0) {
          console.log(`   Line Items: ${payload.line_items.length}`);
          
          // Check if products exist in Prokip
          const prokipService = require('./src/services/prokipService');
          const prokipConfigs = await prisma.prokipConfig.findMany();
          
          if (prokipConfigs.length > 0) {
            const config = prokipConfigs[0];
            const prokipProducts = await prokipService.getProducts(config.locationId, config.userId);
            const prokipSkus = prokipProducts.map(p => p.sku);
            
            console.log(`   Total Prokip products: ${prokipProducts.length}`);
            
            let allProductsFound = true;
            
            for (let i = 0; i < payload.line_items.length; i++) {
              const item = payload.line_items[i];
              const sku = item.sku;
              
              console.log(`   \n   Item ${i + 1}:`);
              console.log(`     SKU: ${sku || 'MISSING SKU'}`);
              console.log(`     Name: ${item.name}`);
              console.log(`     Quantity: ${item.quantity}`);
              
              if (!sku) {
                console.log(`     ❌ MISSING SKU - This is the problem!`);
                allProductsFound = false;
              } else if (prokipSkus.includes(sku)) {
                console.log(`     ✅ Found in Prokip`);
                const prokipProduct = prokipProducts.find(p => p.sku === sku);
                console.log(`     Name: ${prokipProduct.name}`);
                console.log(`     Current Stock: ${prokipProduct.stock || prokipProduct.qty_available || 'N/A'}`);
              } else {
                console.log(`     ❌ NOT found in Prokip - This is the problem!`);
                console.log(`     Available SKUs: ${prokipSkus.slice(0, 5).join(', ')}...`);
                allProductsFound = false;
              }
            }
            
            if (allProductsFound) {
              console.log(`   \n   ✅ All products found in Prokip - trying manual stock reduction...`);
              
              // Try manual stock reduction
              for (const item of payload.line_items) {
                if (item.sku) {
                  try {
                    console.log(`   Attempting stock reduction for SKU: ${item.sku}, Qty: ${item.quantity}`);
                    
                    const result = await prokipService.deductStockFromProkip(
                      [{ productId: item.sku, product_id: item.sku, quantity: item.quantity }],
                      config.locationId,
                      `Immediate fix for order ${payload.id}`,
                      config.userId
                    );
                    
                    if (result.success) {
                      console.log(`   ✅ Stock reduction successful!`);
                      console.log(`   Endpoint: ${result.endpoint}`);
                      
                      // Update the sales log
                      await prisma.salesLog.update({
                        where: { id: failedSale.id },
                        data: { 
                          stockDeducted: true,
                          stockDeductionDate: new Date()
                        }
                      });
                      
                      console.log(`   ✅ Sales log updated - Stock Deducted = true`);
                    } else {
                      console.log(`   ❌ Stock reduction failed: ${result.error}`);
                    }
                  } catch (stockError) {
                    console.log(`   ❌ Stock reduction error: ${stockError.message}`);
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.log(`   ❌ Analysis failed: ${error.message}`);
      }
    } else {
      console.log('   ❌ No matching webhook found for the failed sale');
    }

    // 4. Check for sync errors
    console.log('\n📋 4. Recent Sync Errors');
    
    const recentErrors = await prisma.syncError.findMany({
      where: { 
        connectionId: failedSale.connectionId,
        createdAt: { gte: new Date(Date.now() - 3600000) } // Last hour
      },
      orderBy: { createdAt: 'desc' }
    });

    if (recentErrors.length > 0) {
      console.log(`   Found ${recentErrors.length} recent errors:`);
      recentErrors.forEach((error, index) => {
        console.log(`   Error ${index + 1}: ${error.errorType} - ${error.errorMessage}`);
      });
    } else {
      console.log('   ✅ No recent sync errors');
    }

    // 5. Verify the fix
    console.log('\n📋 5. Verification');
    
    const updatedSale = await prisma.salesLog.findFirst({
      where: { orderId: '14220' }
    });

    if (updatedSale) {
      console.log(`   Order 14220 - Stock Deducted: ${updatedSale.stockDeducted ? '✅ YES' : '❌ NO'}`);
      if (updatedSale.stockDeducted) {
        console.log(`   Stock Deduction Date: ${updatedSale.stockDeductionDate}`);
      }
    }

    console.log('\n🎯 IMMEDIATE FIX SUMMARY:');
    console.log('   1. Identified the failed order');
    console.log('   2. Analyzed webhook payload');
    console.log('   3. Checked product SKUs in Prokip');
    console.log('   4. Attempted manual stock reduction');
    console.log('   5. Updated sales log if successful');

  } catch (error) {
    console.error('\n❌ Immediate fix failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the immediate fix
if (require.main === module) {
  immediateFix()
    .then(() => {
      console.log('\n✨ Immediate fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fix crashed:', error);
      process.exit(1);
    });
}

module.exports = { immediateFix };
