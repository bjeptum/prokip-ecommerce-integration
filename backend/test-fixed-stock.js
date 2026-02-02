/**
 * Test the fixed stock calculation for polo shirts
 */

const prokipService = require('./src/services/prokipService');
const prisma = require('./src/lib/prisma');

async function testFixedStockCalculation() {
  try {
    console.log('🧪 Testing fixed stock calculation...\n');
    
    // Get Prokip config for location ID
    const prokipConfig = await prisma.prokipConfig.findFirst({ 
      where: { userId: 50 } 
    });
    
    console.log('📍 Location ID:', prokipConfig?.locationId);
    
    const products = await prokipService.getProducts(prokipConfig?.locationId || null, 50);
    
    // Look for polo shirts specifically
    const poloShirts = products.filter(p => 
      p.name && p.name.toLowerCase().includes('polo')
    );
    
    console.log(`👕 Found ${poloShirts.length} polo shirts:\n`);
    
    poloShirts.forEach((shirt, index) => {
      console.log(`Polo Shirt ${index + 1}:`);
      console.log(`   Name: ${shirt.name}`);
      console.log(`   SKU: ${shirt.sku}`);
      
      // Calculate stock using the new logic
      let totalStock = 0;
      const variationBreakdown = [];
      
      if (shirt.product_variations && shirt.product_variations.length > 0) {
        shirt.product_variations.forEach(variation => {
          if (variation.variations && variation.variations.length > 0) {
            variation.variations.forEach(v => {
              if (v.variation_location_details && v.variation_location_details.length > 0) {
                v.variation_location_details.forEach(location => {
                  if (location.location_id == prokipConfig?.locationId) {
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
      
      console.log(`   🎯 Total calculated stock: ${totalStock}`);
      console.log(`   📋 Variation breakdown: ${variationBreakdown.join(', ')}`);
      console.log('');
    });
    
    // Test a few other products too
    console.log('📦 Testing other products (first 3):');
    products.slice(0, 3).forEach((product, index) => {
      let totalStock = 0;
      
      if (product.product_variations && product.product_variations.length > 0) {
        product.product_variations.forEach(variation => {
          if (variation.variations && variation.variations.length > 0) {
            variation.variations.forEach(v => {
              if (v.variation_location_details && v.variation_location_details.length > 0) {
                v.variation_location_details.forEach(location => {
                  if (location.location_id == prokipConfig?.locationId) {
                    const qty = parseFloat(location.qty_available || 0);
                    totalStock += qty;
                  }
                });
              }
            });
          }
        });
      }
      
      console.log(`   ${index + 1}. ${product.name} (SKU: ${product.sku}): ${totalStock} units`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFixedStockCalculation();
