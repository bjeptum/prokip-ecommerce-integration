/**
 * Debug Stock Reduction Issues
 * Comprehensive analysis of why WooCommerce sales aren't reducing Prokip stock
 */

const { PrismaClient } = require('@prisma/client');
const { processStoreToProkip } = require('./src/services/syncService');
const prokipService = require('./src/services/prokipService');

const prisma = new PrismaClient();

async function debugStockReductionIssues() {
  console.log('🔍 DEBUGGING: Why WooCommerce Sales Are Not Reducing Prokip Stock');
  console.log('=' .repeat(80));

  try {
    // Step 1: Check if webhooks are being received
    console.log('\n📋 Step 1: Checking Webhook Reception');
    
    const recentWebhooks = await prisma.webhookEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    console.log(`   Recent webhook events: ${recentWebhooks.length}`);
    recentWebhooks.forEach(webhook => {
      console.log(`   - ${webhook.createdAt}: ${webhook.eventType} (processed: ${webhook.processed})`);
      if (webhook.errorMessage) {
        console.log(`     ERROR: ${webhook.errorMessage}`);
      }
    });

    // Step 2: Check recent sales logs
    console.log('\n📋 Step 2: Checking Recent Sales Logs');
    
    const recentSales = await prisma.salesLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        connection: true
      }
    });

    console.log(`   Recent sales logs: ${recentSales.length}`);
    recentSales.forEach(sale => {
      console.log(`   - Order ${sale.orderId}: ${sale.status} (stock deducted: ${sale.stockDeducted})`);
      console.log(`     Platform: ${sale.platform}, Total: ${sale.totalAmount}`);
      if (sale.stockDeductionDate) {
        console.log(`     Stock deduction date: ${sale.stockDeductionDate}`);
      }
    });

    // Step 3: Check sync errors
    console.log('\n📋 Step 3: Checking Sync Errors');
    
    const recentErrors = await prisma.syncError.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        connection: true
      }
    });

    console.log(`   Recent sync errors: ${recentErrors.length}`);
    recentErrors.forEach(error => {
      console.log(`   - ${error.createdAt}: ${error.errorType}`);
      console.log(`     Connection: ${error.connection?.storeUrl}`);
      console.log(`     Error: ${error.errorMessage}`);
    });

    // Step 4: Test Prokip connection and stock functions
    console.log('\n📋 Step 4: Testing Prokip Connection');
    
    const prokipConfigs = await prisma.prokipConfig.findMany();
    console.log(`   Prokip configurations: ${prokipConfigs.length}`);
    
    for (const config of prokipConfigs) {
      console.log(`   - User ${config.userId}: Location ${config.locationId}`);
      console.log(`     API URL: ${config.apiUrl}`);
      console.log(`     Token expires: ${config.expiresAt}`);
      
      // Test authentication
      try {
        const isAuthenticated = await prokipService.isAuthenticated(config.userId);
        console.log(`     Authenticated: ${isAuthenticated ? '✅' : '❌'}`);
        
        if (isAuthenticated) {
          // Test getting products
          try {
            const products = await prokipService.getProducts(config.locationId, config.userId);
            console.log(`     Products available: ${products.length}`);
            
            // Test stock adjustment on a sample product
            if (products.length > 0) {
              const sampleProduct = products[0];
              console.log(`     Testing stock adjustment on: ${sampleProduct.name} (SKU: ${sampleProduct.sku})`);
              
              try {
                const result = await prokipService.adjustStockInProkip(sampleProduct.sku, 1, config.userId);
                console.log(`     ✅ Stock adjustment successful: ${result.success}`);
              } catch (adjustError) {
                console.log(`     ❌ Stock adjustment failed: ${adjustError.message}`);
              }
            }
          } catch (productsError) {
            console.log(`     ❌ Failed to get products: ${productsError.message}`);
          }
        }
      } catch (authError) {
        console.log(`     ❌ Authentication test failed: ${authError.message}`);
      }
    }

    // Step 5: Check WooCommerce connections
    console.log('\n📋 Step 5: Checking WooCommerce Connections');
    
    const wooConnections = await prisma.connection.findMany({
      where: { platform: 'woocommerce' },
      include: {
        inventoryLogs: true,
        salesLogs: true,
        syncErrors: true
      }
    });

    console.log(`   WooCommerce connections: ${wooConnections.length}`);
    
    for (const conn of wooConnections) {
      console.log(`   - Store: ${conn.storeUrl}`);
      console.log(`     Sync enabled: ${conn.syncEnabled}`);
      console.log(`     Last sync: ${conn.lastSync}`);
      console.log(`     Inventory logs: ${conn.inventoryLogs.length}`);
      console.log(`     Sales logs: ${conn.salesLogs.length}`);
      console.log(`     Sync errors: ${conn.syncErrors.length}`);
      
      // Check if webhooks are properly configured
      console.log(`     Webhook URL should be: http://localhost:3000/webhooks/woocommerce`);
    }

    // Step 6: Simulate a test webhook
    console.log('\n📋 Step 6: Simulating Test Webhook');
    
    if (wooConnections.length > 0) {
      const testConnection = wooConnections[0];
      const testOrder = {
        id: `TEST-${Date.now()}`,
        number: `WC-TEST-${Date.now()}`,
        status: 'processing', // This should trigger stock reduction
        date_created: new Date().toISOString(),
        total: '99.99',
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
            sku: 'TEST-SKU',
            name: 'Test Product',
            quantity: 2,
            price: '49.99'
          }
        ]
      };

      console.log(`   Simulating webhook for connection ${testConnection.id}`);
      console.log(`   Order ID: ${testOrder.id}, Status: ${testOrder.status}`);
      
      try {
        await processStoreToProkip(
          testConnection.storeUrl,
          'order.created',
          testOrder,
          'woocommerce',
          testConnection.userId
        );
        
        console.log('   ✅ Webhook processed successfully');
        
        // Wait a moment and check results
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if sales log was created
        const testSalesLog = await prisma.salesLog.findFirst({
          where: {
            connectionId: testConnection.id,
            orderId: testOrder.id
          }
        });
        
        if (testSalesLog) {
          console.log(`   ✅ Sales log created: ${testSalesLog.stockDeducted ? 'Stock deducted' : 'Stock NOT deducted'}`);
        } else {
          console.log('   ❌ No sales log created');
        }
        
      } catch (webhookError) {
        console.log(`   ❌ Webhook processing failed: ${webhookError.message}`);
      }
    }

    // Step 7: Analysis and Recommendations
    console.log('\n📋 Step 7: Analysis and Recommendations');
    console.log('=' .repeat(80));
    
    const hasRecentWebhooks = recentWebhooks.length > 0;
    const hasRecentSales = recentSales.length > 0;
    const hasErrors = recentErrors.length > 0;
    const hasProkipConfig = prokipConfigs.length > 0;
    const hasWooConnections = wooConnections.length > 0;
    
    console.log(`🔍 Analysis Results:`);
    console.log(`   - Webhooks being received: ${hasRecentWebhooks ? '✅' : '❌'}`);
    console.log(`   - Sales being created: ${hasRecentSales ? '✅' : '❌'}`);
    console.log(`   - Sync errors occurring: ${hasErrors ? '⚠️' : '✅'}`);
    console.log(`   - Prokip configured: ${hasProkipConfig ? '✅' : '❌'}`);
    console.log(`   - WooCommerce connected: ${hasWooConnections ? '✅' : '❌'}`);
    
    if (!hasRecentWebhooks) {
      console.log('\n❌ ISSUE: Webhooks are not being received');
      console.log('💡 SOLUTION: Check WooCommerce webhook configuration');
      console.log('   - Webhook URL: http://localhost:3000/webhooks/woocommerce');
      console.log('   - Topics: order.created, order.updated, order.paid');
    }
    
    if (hasRecentSales && recentSales.some(s => !s.stockDeducted)) {
      console.log('\n❌ ISSUE: Sales are recorded but stock is not being deducted');
      console.log('💡 SOLUTION: Check Prokip authentication and API endpoints');
      console.log('   - Verify Prokip credentials are valid');
      console.log('   - Test stock adjustment endpoints manually');
    }
    
    if (hasErrors) {
      console.log('\n❌ ISSUE: Sync errors are occurring');
      console.log('💡 SOLUTION: Review error messages above');
      console.log('   - Common issues: Authentication, API endpoints, product mapping');
    }
    
    if (!hasProkipConfig) {
      console.log('\n❌ ISSUE: Prokip is not configured');
      console.log('💡 SOLUTION: Configure Prokip credentials in the system');
    }
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Ensure WooCommerce webhooks are properly configured');
    console.log('2. Verify Prokip authentication is working');
    console.log('3. Test stock adjustment endpoints manually');
    console.log('4. Check server logs for webhook processing errors');

  } catch (error) {
    console.error('\n❌ Debugging failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the debugging
if (require.main === module) {
  debugStockReductionIssues()
    .then(() => {
      console.log('\n✨ Debugging completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Debugging crashed:', error);
      process.exit(1);
    });
}

module.exports = { debugStockReductionIssues };
