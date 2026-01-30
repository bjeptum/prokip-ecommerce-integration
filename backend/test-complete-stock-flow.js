/**
 * TEST: Complete WooCommerce to Prokip Stock Reduction Flow
 * Tests the enhanced webhook endpoint and stock reduction
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCompleteStockReductionFlow() {
  console.log('🧪 TESTING COMPLETE WOOCOMMERCE TO PROKIP STOCK REDUCTION FLOW');
  console.log('=' .repeat(70));

  try {
    // Step 1: Test webhook endpoint directly
    console.log('\n📋 Step 1: Testing Webhook Endpoint');
    
    const testOrder = {
      id: `TEST-${Date.now()}`,
      number: `WC-TEST-${Date.now()}`,
      status: 'processing', // This should trigger stock reduction
      date_created: new Date().toISOString(),
      total: '149.99',
      customer: {
        first_name: 'Test',
        email: 'test@example.com'
      },
      billing: {
        first_name: 'Test',
        email: 'test@example.com'
      },
      line_items: [
        {
          id: 1,
          sku: 'TEST-SKU-001',
          name: 'Test Product A',
          quantity: 2,
          price: '50.00'
        },
        {
          id: 2,
          sku: 'TEST-SKU-002',
          name: 'Test Product B',
          quantity: 1,
          price: '49.99'
        }
      ]
    };

    console.log('📦 Sending test webhook...');
    console.log(`   Order ID: ${testOrder.id}`);
    console.log(`   Status: ${testOrder.status}`);
    console.log(`   Products: ${testOrder.line_items.length} items`);

    try {
      const response = await axios.post('http://localhost:3000/webhooks/woocommerce', testOrder, {
        headers: {
          'Content-Type': 'application/json',
          'X-WC-Webhook-Topic': 'order.created',
          'X-WC-Webhook-Source': 'https://test-woocommerce.example.com'
        },
        timeout: 10000
      });

      if (response.status === 200) {
        console.log('✅ Webhook endpoint responded successfully');
      } else {
        console.log(`⚠️ Webhook endpoint responded with status: ${response.status}`);
      }
    } catch (webhookError) {
      console.log('❌ Webhook endpoint test failed:', webhookError.message);
      if (webhookError.code === 'ECONNREFUSED') {
        console.log('💡 Make sure the server is running on localhost:3000');
      }
      return;
    }

    // Step 2: Wait for processing and check webhook events
    console.log('\n📋 Step 2: Checking Webhook Event Storage');
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for async processing
    
    const webhookEvents = await prisma.webhookEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log(`   Recent webhook events: ${webhookEvents.length}`);
    const testWebhookEvent = webhookEvents.find(event => 
      event.payload.includes(testOrder.id)
    );

    if (testWebhookEvent) {
      console.log(`✅ Test webhook found in database`);
      console.log(`   Event ID: ${testWebhookEvent.id}`);
      console.log(`   Processed: ${testWebhookEvent.processed}`);
      console.log(`   Created: ${testWebhookEvent.createdAt}`);
    } else {
      console.log('❌ Test webhook not found in database');
    }

    // Step 3: Check sales logs
    console.log('\n📋 Step 3: Checking Sales Logs');
    
    const salesLogs = await prisma.salesLog.findMany({
      orderBy: { syncedAt: 'desc' },
      take: 5,
      include: {
        connection: true
      }
    });

    console.log(`   Recent sales logs: ${salesLogs.length}`);
    const testSaleLog = salesLogs.find(sale => 
      sale.orderId === testOrder.id.toString()
    );

    if (testSaleLog) {
      console.log(`✅ Test sale found in database`);
      console.log(`   Sale ID: ${testSaleLog.id}`);
      console.log(`   Platform: ${testSaleLog.platform}`);
      console.log(`   Total: ${testSaleLog.totalAmount}`);
      console.log(`   Stock Deducted: ${testSaleLog.stockDeducted ? 'YES' : 'NO'}`);
      if (testSaleLog.stockDeductionDate) {
        console.log(`   Stock Deduction Date: ${testSaleLog.stockDeductionDate}`);
      }
    } else {
      console.log('❌ Test sale not found in database');
    }

    // Step 4: Check for sync errors
    console.log('\n📋 Step 4: Checking Sync Errors');
    
    const syncErrors = await prisma.syncError.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        connection: true
      }
    });

    console.log(`   Recent sync errors: ${syncErrors.length}`);
    if (syncErrors.length > 0) {
      console.log('   Recent errors:');
      syncErrors.forEach(error => {
        console.log(`   - ${error.errorType}: ${error.errorMessage}`);
      });
    }

    // Step 5: Test Prokip stock functions (if configured)
    console.log('\n📋 Step 5: Testing Prokip Stock Functions');
    
    const prokipConfigs = await prisma.prokipConfig.findMany();
    if (prokipConfigs.length > 0) {
      console.log(`   Prokip configurations found: ${prokipConfigs.length}`);
      
      for (const config of prokipConfigs) {
        console.log(`   Testing for user ${config.userId}...`);
        
        try {
          // Test authentication
          const prokipService = require('./src/services/prokipService');
          const isAuthenticated = await prokipService.isAuthenticated(config.userId);
          console.log(`     Authenticated: ${isAuthenticated ? '✅' : '❌'}`);
          
          if (isAuthenticated) {
            // Test stock adjustment
            try {
              const result = await prokipService.adjustStockInProkip('TEST-SKU-001', 1, config.userId);
              console.log(`     Stock adjustment test: ${result.success ? '✅' : '❌'}`);
            } catch (adjustError) {
              console.log(`     Stock adjustment test: ❌ ${adjustError.message}`);
            }
          }
        } catch (testError) {
          console.log(`     Prokip test failed: ${testError.message}`);
        }
      }
    } else {
      console.log('   ⚠️ No Prokip configurations found');
    }

    // Step 6: Final Analysis
    console.log('\n📋 Step 6: Final Analysis');
    console.log('=' .repeat(70));
    
    const webhookReceived = webhookEvents.length > 0;
    const webhookProcessed = testWebhookEvent?.processed || false;
    const saleCreated = !!testSaleLog;
    const stockDeducted = testSaleLog?.stockDeducted || false;
    const hasErrors = syncErrors.length > 0;
    
    console.log(`🎯 TEST RESULTS:`);
    console.log(`   - Webhook Received: ${webhookReceived ? '✅' : '❌'}`);
    console.log(`   - Webhook Processed: ${webhookProcessed ? '✅' : '❌'}`);
    console.log(`   - Sale Created: ${saleCreated ? '✅' : '❌'}`);
    console.log(`   - Stock Deducted: ${stockDeducted ? '✅' : '❌'}`);
    console.log(`   - No Errors: ${!hasErrors ? '✅' : '❌'}`);
    
    if (webhookReceived && webhookProcessed && saleCreated && stockDeducted && !hasErrors) {
      console.log('\n🎉 SUCCESS: Complete stock reduction flow is working!');
      console.log('✅ WooCommerce sales will reduce Prokip stock automatically');
    } else {
      console.log('\n⚠️ ISSUES IDENTIFIED:');
      
      if (!webhookReceived) {
        console.log('❌ Webhook endpoint not receiving requests');
        console.log('💡 Check: Server running, firewall, network connectivity');
      }
      
      if (webhookReceived && !webhookProcessed) {
        console.log('❌ Webhook received but not processed');
        console.log('💡 Check: Server logs, processing errors, database issues');
      }
      
      if (saleCreated && !stockDeducted) {
        console.log('❌ Sale created but stock not deducted');
        console.log('💡 Check: Prokip authentication, API endpoints, product SKUs');
      }
      
      if (hasErrors) {
        console.log('❌ Sync errors occurring');
        console.log('💡 Check: Error details above for specific issues');
      }
    }

    // Step 7: Recommendations
    console.log('\n📋 Step 7: Next Steps');
    
    if (!webhookReceived) {
      console.log('1. Start the server: npm start');
      console.log('2. Test webhook endpoint manually with curl');
      console.log('3. Configure WooCommerce webhooks to point to your server');
    }
    
    if (webhookReceived && !saleCreated) {
      console.log('1. Check server logs for webhook processing errors');
      console.log('2. Verify database connection and schema');
      console.log('3. Check WooCommerce connection configuration');
    }
    
    if (saleCreated && !stockDeducted) {
      console.log('1. Verify Prokip credentials are valid');
      console.log('2. Test Prokip API endpoints manually');
      console.log('3. Check product SKU mapping between WooCommerce and Prokip');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  testCompleteStockReductionFlow()
    .then(() => {
      console.log('\n✨ Complete test finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test crashed:', error);
      process.exit(1);
    });
}

module.exports = { testCompleteStockReductionFlow };
