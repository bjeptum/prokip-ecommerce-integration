/**
 * INVESTIGATE RECENT SALE: Check why stock deduction failed for order 14219
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function investigateRecentSale() {
  console.log('🔍 INVESTIGATE RECENT SALE: Order 14219');
  console.log('=' .repeat(60));

  try {
    // 1. Get the failed sales log
    console.log('\n📋 1. Failed Sales Log Details');
    
    const failedSale = await prisma.salesLog.findFirst({
      where: { 
        orderId: '14219',
        stockDeducted: false 
      },
      include: {
        connection: true
      }
    });

    if (!failedSale) {
      console.log('   ❌ No failed sale found for order 14219');
      return;
    }

    console.log(`   Order ID: ${failedSale.orderId}`);
    console.log(`   Platform: ${failedSale.platform}`);
    console.log(`   Total Amount: ${failedSale.totalAmount}`);
    console.log(`   Synced At: ${failedSale.syncedAt}`);
    console.log(`   Connection: ${failedSale.connection?.storeUrl}`);

    // 2. Check the webhook event for this order
    console.log('\n📋 2. Webhook Event Analysis');
    
    const webhookEvent = await prisma.webhookEvent.findFirst({
      where: { 
        connectionId: failedSale.connectionId,
        processed: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (webhookEvent) {
      console.log(`   Webhook Event ID: ${webhookEvent.id}`);
      console.log(`   Event Type: ${webhookEvent.eventType}`);
      console.log(`   Created At: ${webhookEvent.createdAt}`);
      
      try {
        const payload = JSON.parse(webhookEvent.payload);
        console.log(`   Order ID from webhook: ${payload.id}`);
        console.log(`   Order Status: ${payload.status}`);
        console.log(`   Customer: ${payload.customer?.first_name} ${payload.customer?.last_name}`);
        console.log(`   Total: ${payload.total}`);
        
        if (payload.line_items && payload.line_items.length > 0) {
          console.log(`   Line Items: ${payload.line_items.length}`);
          payload.line_items.forEach((item, index) => {
            console.log(`     Item ${index + 1}:`);
            console.log(`       SKU: ${item.sku || 'NO SKU'}`);
            console.log(`       Name: ${item.name}`);
            console.log(`       Quantity: ${item.quantity}`);
            console.log(`       Price: ${item.price}`);
          });
        }
      } catch (parseError) {
        console.log('   ❌ Could not parse webhook payload');
      }
    }

    // 3. Check for sync errors
    console.log('\n📋 3. Sync Error Analysis');
    
    const syncErrors = await prisma.syncError.findMany({
      where: { 
        connectionId: failedSale.connectionId,
        createdAt: { gte: new Date(Date.now() - 3600000) } // Last hour
      },
      orderBy: { createdAt: 'desc' }
    });

    if (syncErrors.length > 0) {
      console.log(`   Found ${syncErrors.length} recent sync errors:`);
      syncErrors.forEach((error, index) => {
        console.log(`   Error ${index + 1}:`);
        console.log(`     Type: ${error.errorType}`);
        console.log(`     Message: ${error.errorMessage}`);
        console.log(`     Created At: ${error.createdAt}`);
        
        if (error.errorDetails) {
          try {
            const details = JSON.parse(error.errorDetails);
            console.log(`     Order ID: ${details.orderId}`);
            console.log(`     Store URL: ${details.storeUrl}`);
          } catch (e) {
            console.log(`     Details: ${error.errorDetails}`);
          }
        }
      });
    } else {
      console.log('   ✅ No recent sync errors found');
    }

    // 4. Check if products exist in Prokip
    console.log('\n📋 4. Product Validation in Prokip');
    
    if (webhookEvent) {
      try {
        const payload = JSON.parse(webhookEvent.payload);
        
        if (payload.line_items && payload.line_items.length > 0) {
          const prokipService = require('./src/services/prokipService');
          const prokipConfigs = await prisma.prokipConfig.findMany();
          
          if (prokipConfigs.length > 0) {
            const config = prokipConfigs[0];
            console.log(`   Checking products for User ID: ${config.userId}, Location: ${config.locationId}`);
            
            // Get all Prokip products
            const prokipProducts = await prokipService.getProducts(config.locationId, config.userId);
            const prokipSkus = prokipProducts.map(p => p.sku);
            
            console.log(`   Total Prokip products: ${prokipProducts.length}`);
            
            // Check each line item
            for (let i = 0; i < payload.line_items.length; i++) {
              const item = payload.line_items[i];
              const sku = item.sku;
              
              console.log(`   \n   Item ${i + 1} - SKU: ${sku}`);
              
              if (!sku) {
                console.log(`     ❌ NO SKU - This is the problem!`);
              } else if (prokipSkus.includes(sku)) {
                console.log(`     ✅ Found in Prokip`);
                const prokipProduct = prokipProducts.find(p => p.sku === sku);
                console.log(`     Name: ${prokipProduct.name}`);
                console.log(`     Current Stock: ${prokipProduct.stock || prokipProduct.qty_available || 'N/A'}`);
              } else {
                console.log(`     ❌ NOT found in Prokip - This is the problem!`);
                console.log(`     Available SKUs: ${prokipSkus.slice(0, 10).join(', ')}...`);
              }
            }
          }
        }
      } catch (error) {
        console.log(`   ❌ Product validation failed: ${error.message}`);
      }
    }

    // 5. Manual stock reduction attempt
    console.log('\n📋 5. Manual Stock Reduction Test');
    
    if (webhookEvent) {
      try {
        const payload = JSON.parse(webhookEvent.payload);
        
        if (payload.line_items && payload.line_items.length > 0) {
          const prokipService = require('./src/services/prokipService');
          const prokipConfigs = await prisma.prokipConfig.findMany();
          
          if (prokipConfigs.length > 0) {
            const config = prokipConfigs[0];
            
            // Try to manually reduce stock for each item
            for (const item of payload.line_items) {
              if (item.sku) {
                console.log(`   Attempting manual stock reduction for SKU: ${item.sku}`);
                
                try {
                  const result = await prokipService.deductStockFromProkip(
                    [{ productId: item.sku, product_id: item.sku, quantity: item.quantity }],
                    config.locationId,
                    `Manual fix for order ${payload.id}`,
                    config.userId
                  );
                  
                  if (result.success) {
                    console.log(`   ✅ Manual stock reduction successful!`);
                    console.log(`   Endpoint: ${result.endpoint}`);
                    
                    // Update the sales log to reflect successful stock reduction
                    await prisma.salesLog.updateMany({
                      where: { 
                        connectionId: failedSale.connectionId,
                        orderId: failedSale.orderId
                      },
                      data: { 
                        stockDeducted: true,
                        stockDeductionDate: new Date()
                      }
                    });
                    
                    console.log(`   ✅ Sales log updated - Stock Deducted = true`);
                  } else {
                    console.log(`   ❌ Manual stock reduction failed: ${result.error}`);
                  }
                } catch (manualError) {
                  console.log(`   ❌ Manual reduction error: ${manualError.message}`);
                }
              }
            }
          }
        }
      } catch (error) {
        console.log(`   ❌ Manual test failed: ${error.message}`);
      }
    }

    console.log('\n🎯 INVESTIGATION SUMMARY:');
    console.log('   1. Check if line items have SKUs');
    console.log('   2. Check if SKUs exist in Prokip');
    console.log('   3. Manual stock reduction attempted');
    console.log('   4. Sales log updated if successful');

  } catch (error) {
    console.error('\n❌ Investigation failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the investigation
if (require.main === module) {
  investigateRecentSale()
    .then(() => {
      console.log('\n✨ Investigation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Investigation crashed:', error);
      process.exit(1);
    });
}

module.exports = { investigateRecentSale };
