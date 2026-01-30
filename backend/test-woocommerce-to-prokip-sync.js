/**
 * Comprehensive Test: WooCommerce to Prokip Stock Synchronization
 * Tests the complete flow from WooCommerce sale to Prokip stock reduction
 */

const { PrismaClient } = require('@prisma/client');
const { processStoreToProkip } = require('./src/services/syncService');
const prokipService = require('./src/services/prokipService');

const prisma = new PrismaClient();

// Test configuration
const TEST_CONFIG = {
  userId: 1, // Adjust based on your setup
  storeUrl: 'https://test-store.mywoocommerce.com',
  testOrderData: {
    id: 12345,
    number: 'WC-12345',
    status: 'processing', // Paid order
    date_created: '2026-01-28T09:00:00Z',
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
        sku: 'TEST-SKU-001',
        name: 'Test Product 1',
        quantity: 2,
        price: '25.00'
      },
      {
        id: 2,
        sku: 'TEST-SKU-002', 
        name: 'Test Product 2',
        quantity: 1,
        price: '49.99'
      }
    ]
  }
};

async function runComprehensiveTest() {
  console.log('🧪 Starting Comprehensive WooCommerce to Prokip Stock Sync Test');
  console.log('=' .repeat(70));

  try {
    // Step 1: Verify Prokip Authentication
    console.log('\n📋 Step 1: Verifying Prokip Authentication...');
    const isAuthenticated = await prokipService.isAuthenticated(TEST_CONFIG.userId);
    console.log(`   Authentication Status: ${isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}`);
    
    if (!isAuthenticated) {
      console.log('   ⚠️ Please ensure Prokip credentials are configured');
      return;
    }

    // Step 2: Get Prokip Configuration
    console.log('\n📋 Step 2: Getting Prokip Configuration...');
    const prokipConfig = await prokipService.getProkipConfig(TEST_CONFIG.userId);
    console.log(`   Location ID: ${prokipConfig?.locationId || 'Not Found'}`);
    console.log(`   API URL: ${prokipConfig?.apiUrl || process.env.PROKIP_API}`);

    // Step 3: Check Current Stock Levels
    console.log('\n📋 Step 3: Checking Current Stock Levels...');
    const currentInventory = await prokipService.getInventory(prokipConfig?.locationId, TEST_CONFIG.userId);
    
    const testProducts = TEST_CONFIG.testOrderData.line_items;
    console.log('   Current Stock Levels:');
    for (const product of testProducts) {
      const stockItem = currentInventory.find(item => item.sku === product.sku);
      const currentStock = stockItem ? parseInt(stockItem.stock || stockItem.qty_available || 0) : 0;
      console.log(`   - SKU ${product.sku}: ${currentStock} units`);
    }

    // Step 4: Create Test Connection in Database
    console.log('\n📋 Step 4: Creating Test Connection...');
    let connection = await prisma.connection.findFirst({
      where: { storeUrl: TEST_CONFIG.storeUrl }
    });

    if (!connection) {
      connection = await prisma.connection.create({
        data: {
          storeUrl: TEST_CONFIG.storeUrl,
          platform: 'woocommerce',
          status: 'connected',
          syncEnabled: true,
          userId: TEST_CONFIG.userId
        }
      });
      console.log(`   ✅ Created connection ID: ${connection.id}`);
    } else {
      console.log(`   ✅ Using existing connection ID: ${connection.id}`);
    }

    // Step 5: Create Inventory Logs for Test Products
    console.log('\n📋 Step 5: Setting Up Inventory Logs...');
    for (const product of testProducts) {
      const existingLog = await prisma.inventoryLog.findFirst({
        where: {
          connectionId: connection.id,
          sku: product.sku
        }
      });

      if (!existingLog) {
        await prisma.inventoryLog.create({
          data: {
            connectionId: connection.id,
            sku: product.sku,
            quantity: 100, // Start with 100 units
            productId: product.id.toString(),
            productName: product.name,
            price: parseFloat(product.price)
          }
        });
        console.log(`   ✅ Created inventory log for SKU ${product.sku}`);
      } else {
        console.log(`   ✅ Inventory log exists for SKU ${product.sku}`);
      }
    }

    // Step 6: Simulate WooCommerce Webhook
    console.log('\n📋 Step 6: Simulating WooCommerce Order Webhook...');
    console.log(`   Order ID: ${TEST_CONFIG.testOrderData.id}`);
    console.log(`   Order Status: ${TEST_CONFIG.testOrderData.status}`);
    console.log(`   Products: ${testProducts.length} items`);

    // Process the webhook
    await processStoreToProkip(
      TEST_CONFIG.storeUrl,
      'order.created',
      TEST_CONFIG.testOrderData,
      'woocommerce',
      TEST_CONFIG.userId
    );

    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 7: Verify Sale Recording
    console.log('\n📋 Step 7: Verifying Sale Recording...');
    const salesLog = await prisma.salesLog.findFirst({
      where: {
        connectionId: connection.id,
        orderId: TEST_CONFIG.testOrderData.id.toString()
      }
    });

    if (salesLog) {
      console.log(`   ✅ Sale recorded with ID: ${salesLog.id}`);
      console.log(`   ✅ Prokip Sell ID: ${salesLog.prokipSellId || 'Not Available'}`);
      console.log(`   ✅ Stock Deducted: ${salesLog.stockDeducted ? 'Yes' : 'No'}`);
      console.log(`   ✅ Total Amount: ${salesLog.totalAmount}`);
    } else {
      console.log('   ❌ Sale not found in database');
    }

    // Step 8: Check Stock Reduction
    console.log('\n📋 Step 8: Checking Stock Reduction...');
    const updatedInventory = await prokipService.getInventory(prokipConfig?.locationId, TEST_CONFIG.userId);
    
    console.log('   Updated Stock Levels:');
    let stockReducedCorrectly = true;
    for (const product of testProducts) {
      const stockItem = updatedInventory.find(item => item.sku === product.sku);
      const currentStock = stockItem ? parseInt(stockItem.stock || stockItem.qty_available || 0) : 0;
      const expectedStock = 100 - product.quantity; // Started with 100
      
      const isCorrect = currentStock === expectedStock;
      stockReducedCorrectly = stockReducedCorrectly && isCorrect;
      
      console.log(`   - SKU ${product.sku}: ${currentStock} units (expected: ${expectedStock}) ${isCorrect ? '✅' : '❌'}`);
    }

    // Step 9: Check for Sync Errors
    console.log('\n📋 Step 9: Checking for Sync Errors...');
    const syncErrors = await prisma.syncError.findMany({
      where: {
        connectionId: connection.id,
        orderId: TEST_CONFIG.testOrderData.id.toString()
      }
    });

    if (syncErrors.length === 0) {
      console.log('   ✅ No sync errors recorded');
    } else {
      console.log(`   ❌ Found ${syncErrors.length} sync errors:`);
      syncErrors.forEach(error => {
        console.log(`      - ${error.errorType}: ${error.errorMessage}`);
      });
    }

    // Step 10: Test Summary
    console.log('\n📋 Step 10: Test Summary');
    console.log('=' .repeat(70));
    
    const allTestsPassed = isAuthenticated && salesLog && stockReducedCorrectly && syncErrors.length === 0;
    
    console.log(`🎯 Overall Test Result: ${allTestsPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('\n📊 Detailed Results:');
    console.log(`   - Prokip Authentication: ${isAuthenticated ? '✅' : '❌'}`);
    console.log(`   - Sale Recording: ${salesLog ? '✅' : '❌'}`);
    console.log(`   - Stock Reduction: ${stockReducedCorrectly ? '✅' : '❌'}`);
    console.log(`   - No Sync Errors: ${syncErrors.length === 0 ? '✅' : '❌'}`);
    
    if (allTestsPassed) {
      console.log('\n🎉 SUCCESS: WooCommerce sales are properly reducing stock in Prokip!');
    } else {
      console.log('\n⚠️ ISSUES FOUND: Check the detailed results above for troubleshooting.');
    }

    // Cleanup test data (optional)
    console.log('\n📋 Step 11: Cleanup...');
    await prisma.salesLog.deleteMany({
      where: {
        connectionId: connection.id,
        orderId: TEST_CONFIG.testOrderData.id.toString()
      }
    });
    console.log('   ✅ Cleaned up test sales log');

  } catch (error) {
    console.error('\n❌ Test Failed with Error:', error.message);
    console.error('Stack Trace:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  runComprehensiveTest()
    .then(() => {
      console.log('\n✨ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test crashed:', error);
      process.exit(1);
    });
}

module.exports = { runComprehensiveTest, TEST_CONFIG };
