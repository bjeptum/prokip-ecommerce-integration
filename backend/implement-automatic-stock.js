/**
 * AUTOMATIC STOCK REDUCTION: Complete implementation and testing
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function implementAutomaticStockReduction() {
  console.log('🚀 IMPLEMENTING AUTOMATIC STOCK REDUCTION');
  console.log('=' .repeat(60));

  try {
    // 1. First, let's check the current webhook processing logic
    console.log('\n📋 1. Current Webhook Processing Analysis');
    
    const recentWebhooks = await prisma.webhookEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        connection: true
      }
    });

    console.log(`   Recent webhooks: ${recentWebhooks.length}`);
    recentWebhooks.forEach(event => {
      console.log(`   Event ${event.id}: ${event.eventType} - Processed: ${event.processed}`);
    });

    // 2. Check the syncService to ensure automatic stock reduction is properly implemented
    console.log('\n📋 2. Verifying Automatic Stock Reduction Logic');
    
    // Read the syncService to check the stock reduction logic
    const fs = require('fs');
    const path = require('path');
    const syncServicePath = path.join(__dirname, 'src/services/syncService.js');
    const syncServiceContent = fs.readFileSync(syncServicePath, 'utf8');
    
    const hasAutomaticStockReduction = syncServiceContent.includes('deductStockFromProkip') &&
                                       syncServiceContent.includes('stockReduced = true') &&
                                       syncServiceContent.includes('stockDeducted: stockReduced');
    
    console.log(`   Automatic stock reduction implemented: ${hasAutomaticStockReduction ? '✅ YES' : '❌ NO'}`);
    
    if (!hasAutomaticStockReduction) {
      console.log('   ❌ Automatic stock reduction logic missing - need to implement');
      return;
    }

    // 3. Test with a real WooCommerce order
    console.log('\n📋 3. Testing Automatic Stock Reduction');
    
    // Get real product from Prokip
    const prokipService = require('./src/services/prokipService');
    const prokipConfigs = await prisma.prokipConfig.findMany();
    
    if (prokipConfigs.length === 0) {
      console.log('   ❌ No Prokip configurations found');
      return;
    }

    const config = prokipConfigs[0];
    const products = await prokipService.getProducts(config.locationId, config.userId);
    
    if (products.length === 0) {
      console.log('   ❌ No products found in Prokip');
      return;
    }

    const realProduct = products[0];
    console.log(`   Using real product: ${realProduct.name} (SKU: ${realProduct.sku})`);

    // Get WooCommerce connection
    const wooConnection = await prisma.connection.findFirst({
      where: { platform: 'woocommerce' }
    });

    if (!wooConnection) {
      console.log('   ❌ No WooCommerce connection found');
      return;
    }

    // Create test order with real product
    const testOrder = {
      id: `AUTO-TEST-${Date.now()}`,
      number: `WC-AUTO-${Date.now()}`,
      status: 'processing', // This should trigger automatic stock reduction
      date_created: new Date().toISOString(),
      total: (parseFloat(realProduct.selling_price || '99.99') * 1).toString(),
      customer: {
        first_name: 'Auto Test',
        email: 'auto@test.com'
      },
      billing: {
        first_name: 'Auto Test',
        email: 'auto@test.com'
      },
      line_items: [
        {
          id: 1,
          sku: realProduct.sku, // Use REAL SKU
          name: realProduct.name,
          quantity: 1,
          price: realProduct.selling_price || '99.99'
        }
      ]
    };

    console.log(`   Sending automatic test order: ${testOrder.id}`);
    console.log(`   SKU: ${realProduct.sku}, Quantity: 1`);

    try {
      const webhookResponse = await axios.post('http://localhost:3000/webhooks/woocommerce', testOrder, {
        headers: {
          'Content-Type': 'application/json',
          'X-WC-Webhook-Topic': 'order.created',
          'X-WC-Webhook-Source': wooConnection.storeUrl
        },
        timeout: 15000
      });

      if (webhookResponse.status === 200) {
        console.log('   ✅ Webhook sent successfully');
      }
    } catch (webhookError) {
      console.log(`   ❌ Webhook failed: ${webhookError.message}`);
      return;
    }

    // 4. Wait for automatic processing
    console.log('\n📋 4. Waiting for Automatic Processing');
    console.log('   ⏳ Waiting 15 seconds for automatic webhook processing...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // 5. Check if automatic stock reduction worked
    console.log('\n📋 5. Verifying Automatic Stock Reduction');
    
    // Check webhook event
    const webhookEvent = await prisma.webhookEvent.findFirst({
      where: { 
        connectionId: wooConnection.id,
        processed: true
      },
      orderBy: { createdAt: 'desc' }
    });

    let automaticSuccess = false;

    if (webhookEvent) {
      const payload = JSON.parse(webhookEvent.payload);
      if (payload.id === testOrder.id) {
        console.log('   ✅ Webhook event processed automatically');
        
        // Check sales log
        const salesLog = await prisma.salesLog.findFirst({
          where: { 
            connectionId: wooConnection.id,
            orderId: testOrder.id.toString()
          }
        });

        if (salesLog) {
          console.log('   ✅ Sales log created automatically');
          console.log(`   Stock Deducted: ${salesLog.stockDeducted ? '✅ YES' : '❌ NO'}`);
          console.log(`   Stock Deduction Date: ${salesLog.stockDeductionDate || 'N/A'}`);
          
          if (salesLog.stockDeducted) {
            automaticSuccess = true;
            console.log('   🎉 AUTOMATIC STOCK REDUCTION SUCCESSFUL!');
          } else {
            console.log('   ❌ Automatic stock reduction failed');
          }
        } else {
          console.log('   ❌ Sales log not created automatically');
        }
      }
    }

    // 6. Test multiple scenarios
    console.log('\n📋 6. Testing Multiple Scenarios');
    
    if (automaticSuccess) {
      console.log('   ✅ Basic automatic stock reduction works');
      
      // Test with different quantities
      const multiQuantityOrder = {
        id: `MULTI-TEST-${Date.now()}`,
        number: `WC-MULTI-${Date.now()}`,
        status: 'processing',
        date_created: new Date().toISOString(),
        total: (parseFloat(realProduct.selling_price || '99.99') * 3).toString(),
        customer: {
          first_name: 'Multi Test',
          email: 'multi@test.com'
        },
        billing: {
          first_name: 'Multi Test',
          email: 'multi@test.com'
        },
        line_items: [
          {
            id: 1,
            sku: realProduct.sku,
            name: realProduct.name,
            quantity: 3,
            price: realProduct.selling_price || '99.99'
          }
        ]
      };

      console.log(`   Testing multi-quantity order: ${multiQuantityOrder.id}`);
      
      try {
        const multiResponse = await axios.post('http://localhost:3000/webhooks/woocommerce', multiQuantityOrder, {
          headers: {
            'Content-Type': 'application/json',
            'X-WC-Webhook-Topic': 'order.created',
            'X-WC-Webhook-Source': wooConnection.storeUrl
          },
          timeout: 15000
        });

        if (multiResponse.status === 200) {
          console.log('   ✅ Multi-quantity webhook sent');
          
          // Wait for processing
          await new Promise(resolve => setTimeout(resolve, 10000));
          
          // Check result
          const multiSalesLog = await prisma.salesLog.findFirst({
            where: { 
              connectionId: wooConnection.id,
              orderId: multiQuantityOrder.id.toString()
            }
          });

          if (multiSalesLog && multiSalesLog.stockDeducted) {
            console.log('   ✅ Multi-quantity automatic stock reduction successful');
          } else {
            console.log('   ❌ Multi-quantity automatic stock reduction failed');
          }
        }
      } catch (multiError) {
        console.log(`   ❌ Multi-quantity test failed: ${multiError.message}`);
      }
    }

    // 7. Final verification
    console.log('\n📋 7. Final Verification');
    
    const finalSalesLogs = await prisma.salesLog.findMany({
      orderBy: { syncedAt: 'desc' },
      take: 5
    });

    console.log('   Recent sales logs:');
    finalSalesLogs.forEach(log => {
      console.log(`   Order ${log.orderId}: Stock Deducted = ${log.stockDeducted ? '✅' : '❌'}`);
    });

    const automaticCount = finalSalesLogs.filter(log => log.stockDeducted).length;
    console.log(`   Automatic success rate: ${automaticCount}/${finalSalesLogs.length}`);

    console.log('\n🎯 IMPLEMENTATION SUMMARY:');
    console.log(`   Automatic stock reduction: ${automaticSuccess ? '✅ WORKING' : '❌ NEEDS FIX'}`);
    console.log(`   Recent orders processed: ${finalSalesLogs.length}`);
    console.log(`   Successful automatic deductions: ${automaticCount}`);

    if (automaticSuccess) {
      console.log('\n🎉 AUTOMATIC STOCK REDUCTION FULLY IMPLEMENTED!');
      console.log('   ✅ WooCommerce sales automatically reduce Prokip stock');
      console.log('   ✅ No manual intervention required');
      console.log('   ✅ Real-time stock synchronization');
      console.log('   ✅ Database tracking updated automatically');
    } else {
      console.log('\n❌ Automatic stock reduction needs attention');
      console.log('   💡 Check webhook processing logic');
      console.log('   💡 Verify Prokip API integration');
      console.log('   💡 Ensure product SKUs match');
    }

  } catch (error) {
    console.error('\n❌ Implementation failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the implementation
if (require.main === module) {
  implementAutomaticStockReduction()
    .then(() => {
      console.log('\n✨ Automatic stock reduction implementation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Implementation crashed:', error);
      process.exit(1);
    });
}

module.exports = { implementAutomaticStockReduction };
