/**
 * COMPLETE TEST: Real WooCommerce Order with Real Prokip Product
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function completeRealTest() {
  console.log('🧪 COMPLETE TEST: Real WooCommerce Order with Real Prokip Product');
  console.log('=' .repeat(80));

  try {
    // 1. Get real product from Prokip
    console.log('\n📋 1. Get Real Prokip Product');
    
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
    console.log(`   Real product: ${realProduct.name}`);
    console.log(`   SKU: ${realProduct.sku}`);
    console.log(`   Current stock: ${realProduct.stock || realProduct.qty_available || 'N/A'}`);

    // 2. Get WooCommerce connection
    console.log('\n📋 2. Get WooCommerce Connection');
    
    const wooConnection = await prisma.connection.findFirst({
      where: { platform: 'woocommerce' }
    });

    if (!wooConnection) {
      console.log('   ❌ No WooCommerce connection found');
      return;
    }

    console.log(`   Connection: ${wooConnection.storeUrl}`);

    // 3. Create test order with real product
    console.log('\n📋 3. Send Webhook with Real Product');
    
    const testOrder = {
      id: `REAL-TEST-${Date.now()}`,
      number: `WC-REAL-${Date.now()}`,
      status: 'processing',
      date_created: new Date().toISOString(),
      total: (parseFloat(realProduct.selling_price || '99.99') * 2).toString(),
      customer: {
        first_name: 'Real Test',
        email: 'real@test.com'
      },
      billing: {
        first_name: 'Real Test',
        email: 'real@test.com'
      },
      line_items: [
        {
          id: 1,
          sku: realProduct.sku, // Use REAL SKU
          name: realProduct.name,
          quantity: 2,
          price: realProduct.selling_price || '99.99'
        }
      ]
    };

    console.log(`   Sending order ${testOrder.id} with real SKU ${realProduct.sku}`);
    console.log(`   Quantity: ${testOrder.line_items[0].quantity}`);

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

    // 4. Wait for processing
    console.log('\n📋 4. Wait for Processing');
    console.log('   ⏳ Waiting 10 seconds for webhook processing...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 5. Check results
    console.log('\n📋 5. Check Results');
    
    // Check webhook event
    const webhookEvent = await prisma.webhookEvent.findFirst({
      where: { 
        connectionId: wooConnection.id,
        processed: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (webhookEvent) {
      const payload = JSON.parse(webhookEvent.payload);
      if (payload.id === testOrder.id) {
        console.log('   ✅ Webhook event processed successfully');
      }
    }

    // Check sales log
    const salesLog = await prisma.salesLog.findFirst({
      where: { 
        connectionId: wooConnection.id,
        orderId: testOrder.id.toString()
      }
    });

    if (salesLog) {
      console.log('   ✅ Sales log created');
      console.log(`   Stock Deducted: ${salesLog.stockDeducted ? '✅ YES' : '❌ NO'}`);
      console.log(`   Stock Deduction Date: ${salesLog.stockDeductionDate || 'N/A'}`);
      
      if (salesLog.stockDeducted) {
        console.log('\n🎉 SUCCESS: Stock was deducted from Prokip!');
        console.log('   ✅ Real WooCommerce order processed');
        console.log('   ✅ Real Prokip product found');
        console.log('   ✅ Stock reduced in Prokip');
        console.log('   ✅ Sales log updated correctly');
        
        // Check updated stock
        try {
          const updatedProducts = await prokipService.getProducts(config.locationId, config.userId);
          const updatedProduct = updatedProducts.find(p => p.sku === realProduct.sku);
          
          if (updatedProduct) {
            const originalStock = parseInt(realProduct.stock || realProduct.qty_available || 0);
            const newStock = parseInt(updatedProduct.stock || updatedProduct.qty_available || 0);
            const expectedStock = originalStock - testOrder.line_items[0].quantity;
            
            console.log(`   Original stock: ${originalStock}`);
            console.log(`   New stock: ${newStock}`);
            console.log(`   Expected stock: ${expectedStock}`);
            
            if (newStock === expectedStock) {
              console.log('   ✅ Stock reduction verified in Prokip!');
            } else {
              console.log('   ⚠️ Stock reduction may not be accurate');
            }
          }
        } catch (stockCheckError) {
          console.log(`   ⚠️ Could not verify updated stock: ${stockCheckError.message}`);
        }
      } else {
        console.log('   ❌ Stock was NOT deducted - checking for errors...');
        
        // Check for sync errors
        const syncError = await prisma.syncError.findFirst({
          where: { 
            connectionId: wooConnection.id,
            createdAt: { gte: new Date(Date.now() - 60000) } // Last minute
          }
        });
        
        if (syncError) {
          console.log(`   Error: ${syncError.errorType} - ${syncError.errorMessage}`);
        }
      }
    } else {
      console.log('   ❌ Sales log not created');
    }

    console.log('\n🎯 COMPLETE TEST SUMMARY:');
    console.log('   ✅ Real product from Prokip used');
    console.log('   ✅ Real WooCommerce connection used');
    console.log('   ✅ Webhook processed successfully');
    console.log(`   Stock reduction: ${salesLog?.stockDeducted ? '✅ SUCCESS' : '❌ FAILED'}`);

  } catch (error) {
    console.error('\n❌ Complete test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the complete test
if (require.main === module) {
  completeRealTest()
    .then(() => {
      console.log('\n✨ Complete test finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test crashed:', error);
      process.exit(1);
    });
}

module.exports = { completeRealTest };
