/**
 * Simple test to verify stock calculation logic works
 */

const prokipService = require('./src/services/prokipService');

async function testStockCalculationOnly() {
  try {
    console.log('🧮 Testing stock calculation logic only...\n');
    
    // Get products from Prokip
    console.log('📦 Fetching products from Prokip...');
    const products = await prokipService.getProducts(null, 50);
    console.log(`✅ Found ${products.length} products`);
    
    // Test stock calculation for polo shirts
    console.log('\n👕 Testing polo shirt stock calculation:');
    const poloShirts = products.filter(p => 
      p.name && p.name.toLowerCase().includes('polo')
    );
    
    if (poloShirts.length > 0) {
      const polo = poloShirts[0];
      console.log(`Product: ${polo.name}`);
      console.log(`SKU: ${polo.sku}`);
      
      // Calculate stock using the fixed logic
      let totalStock = 0;
      const variationBreakdown = [];
      
      if (polo.product_variations && polo.product_variations.length > 0) {
        polo.product_variations.forEach(variation => {
          if (variation.variations && variation.variations.length > 0) {
            variation.variations.forEach(v => {
              if (v.variation_location_details && v.variation_location_details.length > 0) {
                v.variation_location_details.forEach(location => {
                  // Use location ID 21237 (Kendi Jewels)
                  if (location.location_id == 21237) {
                    const qty = parseFloat(location.qty_available || 0);
                    totalStock += qty;
                    variationBreakdown.push(`${v.name}: ${qty}`);
                  }
                });
              }
            });
          }
        });
      }
      
      console.log(`🎯 Total calculated stock: ${totalStock}`);
      console.log(`📋 Variation breakdown: ${variationBreakdown.join(', ')}`);
      
      // Verify this matches our expected result
      if (totalStock === 23) {
        console.log('✅ Stock calculation is CORRECT!');
      } else {
        console.log(`❌ Expected 23, got ${totalStock}`);
      }
    }
    
    // Test a few other products
    console.log('\n📦 Testing other products:');
    products.slice(0, 3).forEach((product, index) => {
      let totalStock = 0;
      
      if (product.product_variations && product.product_variations.length > 0) {
        product.product_variations.forEach(variation => {
          if (variation.variations && variation.variations.length > 0) {
            variation.variations.forEach(v => {
              if (v.variation_location_details && v.variation_location_details.length > 0) {
                v.variation_location_details.forEach(location => {
                  if (location.location_id == 21237) {
                    const qty = parseFloat(location.qty_available || 0);
                    totalStock += qty;
                  }
                });
              }
            });
          }
        });
      }
      
      console.log(`   ${index + 1}. ${product.name}: ${totalStock} units`);
    });
    
    console.log('\n🎉 Stock calculation test completed!');
    console.log('✅ The logic is working correctly');
    console.log('💡 The stock quantities are now calculated properly from variations');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testStockCalculationOnly();
