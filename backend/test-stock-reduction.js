/**
 * TEST STOCK REDUCTION: Find out why stock deduction is failing
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testStockReduction() {
  console.log('🧪 TEST STOCK REDUCTION: Why Stock Deduction Failing');
  console.log('=' .repeat(60));

  try {
    // 1. Get a recent sales log that failed stock deduction
    console.log('\n📋 1. Check Failed Stock Deduction');
    
    const failedSalesLog = await prisma.salesLog.findFirst({
      where: { stockDeducted: false },
      orderBy: { syncedAt: 'desc' },
      include: {
        connection: true
      }
    });

    if (!failedSalesLog) {
      console.log('   ✅ No failed stock deductions found');
      return;
    }

    console.log(`   Failed order: ${failedSalesLog.orderId}`);
    console.log(`   Platform: ${failedSalesLog.platform}`);
    console.log(`   Connection: ${failedSalesLog.connection?.storeUrl}`);
    console.log(`   Synced at: ${failedSalesLog.syncedAt}`);

    // 2. Check the corresponding webhook event
    console.log('\n📋 2. Check Webhook Event');
    
    const webhookEvent = await prisma.webhookEvent.findFirst({
      where: { 
        connectionId: failedSalesLog.connectionId,
        processed: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (webhookEvent) {
      console.log(`   Webhook Event ID: ${webhookEvent.id}`);
      console.log(`   Event Type: ${webhookEvent.eventType}`);
      
      try {
        const payload = JSON.parse(webhookEvent.payload);
        console.log(`   Order ID from webhook: ${payload.id}`);
        console.log(`   Order Status: ${payload.status}`);
        console.log(`   Line Items: ${payload.line_items?.length || 0}`);
        
        if (payload.line_items && payload.line_items.length > 0) {
          payload.line_items.forEach((item, index) => {
            console.log(`     Item ${index + 1}: SKU ${item.sku}, Qty ${item.quantity}`);
          });
        }
      } catch (parseError) {
        console.log('   Could not parse webhook payload');
      }
    }

    // 3. Test stock reduction with real product
    console.log('\n📋 3. Test Stock Reduction with Real Product');
    
    try {
      const prokipService = require('./src/services/prokipService');
      const prokipConfigs = await prisma.prokipConfig.findMany({
        where: { userId: failedSalesLog.connection?.userId }
      });
      
      if (prokipConfigs.length > 0) {
        const config = prokipConfigs[0];
        console.log(`   Testing with User ID: ${config.userId}, Location: ${config.locationId}`);
        
        // Get real products
        const products = await prokipService.getProducts(config.locationId, config.userId);
        if (products.length > 0) {
          const realProduct = products[0];
          console.log(`   Real product: ${realProduct.name} (SKU: ${realProduct.sku})`);
          
          // Test stock reduction
          console.log(`   Testing stock reduction for SKU: ${realProduct.sku}`);
          
          try {
            const result = await prokipService.deductStockFromProkip(
              [{ productId: realProduct.sku, product_id: realProduct.sku, quantity: 1 }],
              config.locationId,
              'Manual test stock reduction',
              config.userId
            );
            
            console.log('   ✅ Stock reduction successful!');
            console.log(`   Result: ${JSON.stringify(result, null, 2)}`);
          } catch (stockError) {
            console.log(`   ❌ Stock reduction failed: ${stockError.message}`);
            console.log(`   Error details: ${stockError.stack}`);
            
            // Try fallback method
            try {
              console.log('   Trying fallback method...');
              const fallbackResult = await prokipService.adjustStockInProkip(realProduct.sku, 1, config.userId);
              console.log('   ✅ Fallback stock reduction successful!');
              console.log(`   Result: ${JSON.stringify(fallbackResult, null, 2)}`);
            } catch (fallbackError) {
              console.log(`   ❌ Fallback also failed: ${fallbackError.message}`);
            }
          }
        } else {
          console.log('   ❌ No products found in Prokip');
        }
      } else {
        console.log('   ❌ No Prokip configuration found');
      }
    } catch (error) {
      console.log(`   ❌ Stock reduction test failed: ${error.message}`);
    }

    // 4. Check environment variables
    console.log('\n📋 4. Check Environment');
    console.log(`   PROKIP_API: ${process.env.PROKIP_API || 'NOT SET'}`);
    console.log(`   MOCK_PROKIP: ${process.env.MOCK_PROKIP || 'NOT SET'}`);
    console.log(`   Using Real API: ${process.env.MOCK_PROKIP !== 'true' ? 'YES' : 'NO'}`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  testStockReduction()
    .then(() => {
      console.log('\n✨ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test crashed:', error);
      process.exit(1);
    });
}

module.exports = { testStockReduction };
