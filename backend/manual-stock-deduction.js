const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');

const prisma = new PrismaClient();

/**
 * Manual stock deduction script for air cream and other products
 * This script manually deducts stock to match WooCommerce levels
 */
async function manualStockDeduction() {
  try {
    console.log('🔄 Manual stock deduction to match WooCommerce levels...\n');

    // 1. Get Prokip config
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 } // Use default user ID
    });

    if (!prokipConfig) {
      throw new Error('No Prokip config found for user 50');
    }

    console.log(`✅ Found Prokip config for location: ${prokipConfig.locationId}`);

    // 2. Get current Prokip products
    console.log('\n📦 Loading current Prokip products...');
    const prokipProducts = await prokipService.getProducts(prokipConfig.locationId, 50);
    
    console.log(`✅ Found ${prokipProducts.length} products in Prokip`);

    // 3. Define the stock adjustments needed based on WooCommerce vs Prokit discrepancy
    // Air cream: WooCommerce shows 67, Prokip shows 70 = need to deduct 3
    const stockAdjustments = [
      { 
        sku: 'AIR-CREAM-001', 
        productName: 'Air Cream',
        currentStock: null, // Will be filled from Prokip
        targetStock: 67,     // WooCommerce level
        deduction: null      // Will be calculated
      },
      // Add other products as needed
      { 
        sku: 'LOTION-DRY-031', 
        productName: 'Dry Lotion',
        currentStock: null,
        targetStock: 50, // Example - adjust based on actual WooCommerce data
        deduction: null
      }
    ];

    // 4. Find products and calculate deductions
    const productsToDeduct = [];
    
    for (const adjustment of stockAdjustments) {
      const prokipProduct = prokipProducts.find(p => p.sku === adjustment.sku);
      
      if (prokipProduct) {
        adjustment.currentStock = prokipProduct.stock || 0;
        adjustment.deduction = adjustment.currentStock - adjustment.targetStock;
        
        console.log(`📊 ${adjustment.productName} (${adjustment.sku}):`);
        console.log(`   Current Prokip stock: ${adjustment.currentStock}`);
        console.log(`   Target WooCommerce stock: ${adjustment.targetStock}`);
        console.log(`   Needed deduction: ${adjustment.deduction}`);
        
        if (adjustment.deduction > 0) {
          productsToDeduct.push({
            productId: prokipProduct.id,
            product_id: prokipProduct.id,
            quantity: adjustment.deduction,
            sku: adjustment.sku
          });
        }
      } else {
        console.log(`⚠️ Product ${adjustment.sku} not found in Prokip`);
      }
    }

    if (productsToDeduct.length === 0) {
      console.log('\n✅ No stock deductions needed - all levels match!');
      return;
    }

    // 5. Perform stock deduction
    console.log(`\n🔄 Performing stock deduction for ${productsToDeduct.length} products...`);
    
    try {
      const deductionResponse = await prokipService.deductStockFromProkip(
        productsToDeduct,
        prokipConfig.locationId,
        'Manual stock sync to match WooCommerce levels',
        50
      );
      
      console.log('✅ Stock deduction completed successfully!');
      
      // 6. Verify the results
      console.log('\n🔍 Verifying updated stock levels...');
      const updatedProducts = await prokipService.getProducts(prokipConfig.locationId, 50);
      
      for (const adjustment of stockAdjustments) {
        const updatedProduct = updatedProducts.find(p => p.sku === adjustment.sku);
        if (updatedProduct) {
          console.log(`📊 ${adjustment.productName} (${adjustment.sku}):`);
          console.log(`   Updated stock: ${updatedProduct.stock || 0}`);
          console.log(`   Target stock: ${adjustment.targetStock}`);
          console.log(`   Status: ${updatedProduct.stock === adjustment.targetStock ? '✅ MATCH' : '❌ MISMATCH'}`);
        }
      }
      
    } catch (deductionError) {
      console.error('❌ Stock deduction failed:', deductionError.message);
      console.error('Response:', deductionError.response?.data);
    }

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  manualStockDeduction();
}

module.exports = { manualStockDeduction };
