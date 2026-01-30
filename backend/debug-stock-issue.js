/**
 * DEBUG STOCK REDUCTION: Check why stock isn't being deducted
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function debugStockReduction() {
  console.log('🔍 DEBUG: Why Stock Reduction Not Working');
  console.log('=' .repeat(60));

  try {
    // 1. Check recent webhook events
    console.log('\n📋 1. Recent Webhook Events');
    const webhookEvents = await prisma.webhookEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        connection: true
      }
    });

    webhookEvents.forEach(event => {
      console.log(`   Event ${event.id}: ${event.eventType} - Processed: ${event.processed}`);
      if (event.processedAt) {
        console.log(`   Processed at: ${event.processedAt}`);
      }
    });

    // 2. Check recent sales logs
    console.log('\n📋 2. Recent Sales Logs');
    const salesLogs = await prisma.salesLog.findMany({
      orderBy: { syncedAt: 'desc' },
      take: 10,
      include: {
        connection: true
      }
    });

    if (salesLogs.length === 0) {
      console.log('   ❌ No sales logs found - this is the issue!');
    } else {
      salesLogs.forEach(log => {
        console.log(`   Sale ${log.id}: Order ${log.orderId} - Stock Deducted: ${log.stockDeducted ? 'YES' : 'NO'}`);
        console.log(`   Platform: ${log.platform}, Total: ${log.totalAmount}`);
      });
    }

    // 3. Check sync errors
    console.log('\n📋 3. Recent Sync Errors');
    const syncErrors = await prisma.syncError.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        connection: true
      }
    });

    if (syncErrors.length === 0) {
      console.log('   ✅ No sync errors found');
    } else {
      syncErrors.forEach(error => {
        console.log(`   Error: ${error.errorType} - ${error.errorMessage}`);
        if (error.errorDetails) {
          try {
            const details = JSON.parse(error.errorDetails);
            console.log(`   Order ID: ${details.orderId}`);
          } catch (e) {
            console.log(`   Details: ${error.errorDetails}`);
          }
        }
      });
    }

    // 4. Test with a real product SKU from Prokip
    console.log('\n📋 4. Test with Real Prokip Product');
    
    try {
      const prokipService = require('./src/services/prokipService');
      const prokipConfigs = await prisma.prokipConfig.findMany();
      
      if (prokipConfigs.length > 0) {
        const config = prokipConfigs[0];
        console.log(`   Testing with User ID: ${config.userId}, Location: ${config.locationId}`);
        
        // Get real products
        const products = await prokipService.getProducts(config.locationId, config.userId);
        if (products.length > 0) {
          const realProduct = products[0];
          console.log(`   Real product found: ${realProduct.name} (SKU: ${realProduct.sku})`);
          console.log(`   Current stock: ${realProduct.stock || realProduct.qty_available || 'N/A'}`);
          
          // Test stock reduction with real product
          console.log(`   Testing stock reduction for SKU: ${realProduct.sku}`);
          
          try {
            const result = await prokipService.deductStockFromProkip(
              [{ productId: realProduct.sku, product_id: realProduct.sku, quantity: 1 }],
              config.locationId,
              'Debug test stock reduction',
              config.userId
            );
            
            if (result.success) {
              console.log('   ✅ Stock reduction successful!');
              console.log(`   Endpoint used: ${result.endpoint}`);
            } else {
              console.log(`   ❌ Stock reduction failed: ${result.error}`);
            }
          } catch (stockError) {
            console.log(`   ❌ Stock reduction error: ${stockError.message}`);
            
            // Try fallback method
            try {
              const fallbackResult = await prokipService.adjustStockInProkip(realProduct.sku, 1, config.userId);
              if (fallbackResult.success) {
                console.log('   ✅ Fallback stock reduction successful!');
                console.log(`   Endpoint used: ${fallbackResult.endpoint}`);
              } else {
                console.log(`   ❌ Fallback also failed: ${fallbackResult.error}`);
              }
            } catch (fallbackError) {
              console.log(`   ❌ Fallback error: ${fallbackError.message}`);
            }
          }
        }
      }
    } catch (error) {
      console.log(`   ❌ Product test failed: ${error.message}`);
    }

    // 5. Test webhook with real product SKU
    console.log('\n📋 5. Test Webhook with Real Product SKU');
    
    if (salesLogs.length === 0) {
      console.log('   Testing webhook with real product SKU...');
      
      try {
        const prokipService = require('./src/services/prokipService');
        const prokipConfigs = await prisma.prokipConfig.findMany();
        
        if (prokipConfigs.length > 0) {
          const config = prokipConfigs[0];
          const products = await prokipService.getProducts(config.locationId, config.userId);
          
          if (products.length > 0) {
            const realProduct = products[0];
            const wooConnection = await prisma.connection.findFirst({
              where: { platform: 'woocommerce' }
            });
            
            const testOrder = {
              id: `DEBUG-TEST-${Date.now()}`,
              number: `WC-DEBUG-${Date.now()}`,
              status: 'processing',
              date_created: new Date().toISOString(),
              total: '99.99',
              customer: {
                first_name: 'Debug Test',
                email: 'debug@test.com'
              },
              billing: {
                first_name: 'Debug Test',
                email: 'debug@test.com'
              },
              line_items: [
                {
                  id: 1,
                  sku: realProduct.sku, // Use real SKU
                  name: realProduct.name,
                  quantity: 1,
                  price: '99.99'
                }
              ]
            };

            console.log(`   Sending webhook with real SKU: ${realProduct.sku}`);
            
            const webhookResponse = await axios.post('http://localhost:3000/webhooks/woocommerce', testOrder, {
              headers: {
                'Content-Type': 'application/json',
                'X-WC-Webhook-Topic': 'order.created',
                'X-WC-Webhook-Source': wooConnection.storeUrl
              },
              timeout: 15000
            });

            if (webhookResponse.status === 200) {
              console.log('   ✅ Webhook sent with real product SKU');
              console.log('   ⏳ Waiting for processing...');
              
              // Wait for processing
              await new Promise(resolve => setTimeout(resolve, 5000));
              
              // Check if sales log was created
              const newSalesLogs = await prisma.salesLog.findMany({
                orderBy: { syncedAt: 'desc' },
                take: 3
              });
              
              const debugSale = newSalesLogs.find(log => 
                log.orderId === testOrder.id.toString()
              );
              
              if (debugSale) {
                console.log('   ✅ Sales log created for real product!');
                console.log(`   Stock Deducted: ${debugSale.stockDeducted ? 'YES' : 'NO'}`);
              } else {
                console.log('   ❌ Sales log still not created even with real SKU');
              }
            }
          }
        }
      } catch (error) {
        console.log(`   ❌ Webhook test failed: ${error.message}`);
      }
    }

    console.log('\n🎯 DEBUG SUMMARY:');
    console.log('   - Check if sales logs are being created');
    console.log('   - Check if stock deduction is working with real SKUs');
    console.log('   - Check for any sync errors');
    console.log('   - Verify webhook processing with real products');

  } catch (error) {
    console.error('\n❌ Debug failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the debug
if (require.main === module) {
  debugStockReduction()
    .then(() => {
      console.log('\n✨ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Debug crashed:', error);
      process.exit(1);
    });
}

module.exports = { debugStockReduction };
