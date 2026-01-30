const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');

const prisma = new PrismaClient();

/**
 * Alternative stock sync using updateProductStock function
 * This script uses the existing updateProductStock function to set stock levels
 */
async function alternativeStockSync() {
  try {
    console.log('🔄 Alternative Stock Sync - Using updateProductStock function...\n');

    // 1. Get Prokip config
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });

    if (!prokipConfig) {
      throw new Error('No Prokip config found for user 50');
    }

    console.log(`✅ Found Prokip config for location: ${prokipConfig.locationId}`);

    // 2. Define the current WooCommerce stock levels
    const wooStockLevels = [
      { 
        sku: '4815445', // Claire Wash (possible air cream)
        name: 'Claire Wash (Air Cream)',
        wooStock: 67,
        prokipProductId: 4815445
      },
      { 
        sku: '4848961', // Hair cream
        name: 'Hair Cream',
        wooStock: 50,
        prokipProductId: 4848961
      },
      { 
        sku: '4846757', // Sampoo oil
        name: 'Shampoo Oil',
        wooStock: 30,
        prokipProductId: 4846757
      },
      { 
        sku: '4846767', // Sunlit Soap
        name: 'Sunlit Soap',
        wooStock: 25,
        prokipProductId: 4846767
      }
    ];

    console.log(`📋 Updating ${wooStockLevels.length} products to match WooCommerce levels`);

    // 3. Update each product's stock using updateProductStock
    for (const product of wooStockLevels) {
      try {
        console.log(`\n🔄 Updating ${product.name} (ID: ${product.prokipProductId}) to ${product.wooStock} units...`);
        
        const updateResponse = await prokipService.updateProductStock(
          product.prokipProductId,
          product.wooStock,
          prokipConfig.locationId,
          50
        );
        
        console.log(`✅ Successfully updated ${product.name}`);
        console.log(`   Response:`, updateResponse);
        
      } catch (error) {
        console.error(`❌ Failed to update ${product.name}:`, error.message);
        console.error(`   Response:`, error.response?.data);
      }
    }

    // 4. Verify the results
    console.log('\n🔍 Verifying updated stock levels...');
    const updatedProducts = await prokipService.getProducts(prokipConfig.locationId, 50);
    
    console.log('\n📊 Updated Stock Levels:');
    console.log('SKU'.padEnd(12) + ' | WooCommerce | Prokip | Status');
    console.log('-'.repeat(45));
    
    for (const wooProduct of wooStockLevels) {
      const prokipProduct = updatedProducts.find(p => p.id === wooProduct.prokipProductId);
      const prokipStock = prokipProduct ? (prokipProduct.stock || 0) : 0;
      const status = prokipStock === wooProduct.wooStock ? '✅ MATCH' : '❌ MISMATCH';
      
      console.log(`${wooProduct.sku.padEnd(12)} | ${wooProduct.wooStock.toString().padEnd(11)} | ${prokipStock.toString().padEnd(6)} | ${status}`);
    }

    // 5. Test stock deduction with a small adjustment
    console.log('\n🧪 Testing stock deduction functionality...');
    const testProduct = wooStockLevels[0]; // Test with first product
    
    try {
      console.log(`🔄 Testing deduction of 1 unit from ${testProduct.name}...`);
      
      const deductionResponse = await prokipService.deductStockFromProkip(
        [{
          productId: testProduct.prokipProductId,
          product_id: testProduct.prokipProductId,
          quantity: 1,
          sku: testProduct.sku
        }],
        prokipConfig.locationId,
        'Test stock deduction',
        50
      );
      
      console.log('✅ Stock deduction test successful!');
      console.log('   Response:', deductionResponse);
      
      // Verify the deduction worked
      const finalProducts = await prokipService.getProducts(prokipConfig.locationId, 50);
      const finalProduct = finalProducts.find(p => p.id === testProduct.prokipProductId);
      const finalStock = finalProduct ? (finalProduct.stock || 0) : 0;
      const expectedStock = testProduct.wooStock - 1;
      
      console.log(`\n📊 Test Results:`);
      console.log(`   Expected stock: ${expectedStock}`);
      console.log(`   Actual stock: ${finalStock}`);
      console.log(`   Status: ${finalStock === expectedStock ? '✅ SUCCESS' : '❌ FAILED'}`);
      
      // Restore the stock
      if (finalStock === expectedStock) {
        console.log(`\n🔄 Restoring stock to original level...`);
        await prokipService.updateProductStock(
          testProduct.prokipProductId,
          testProduct.wooStock,
          prokipConfig.locationId,
          50
        );
        console.log('✅ Stock restored successfully');
      }
      
    } catch (deductionError) {
      console.error('❌ Stock deduction test failed:', deductionError.message);
      console.error('   Response:', deductionError.response?.data);
    }

    console.log('\n🎉 Alternative stock sync completed!');

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  alternativeStockSync();
}

module.exports = { alternativeStockSync };
