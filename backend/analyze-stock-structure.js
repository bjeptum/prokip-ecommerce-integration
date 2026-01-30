/**
 * ANALYZE STOCK STRUCTURE: Check how stock is stored in Prokip products
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function analyzeStockStructure() {
  console.log('🔍 ANALYZING PROKIP STOCK STRUCTURE');
  console.log('=' .repeat(60));

  try {
    const prokipService = require('./src/services/prokipService');
    const prokipConfigs = await prisma.prokipConfig.findMany();
    
    if (prokipConfigs.length === 0) {
      console.log('❌ No Prokip configurations found');
      return;
    }

    const config = prokipConfigs[0];
    
    // Get all products
    const products = await prokipService.getProducts(config.locationId, config.userId);
    console.log(`Total products: ${products.length}`);
    
    // Analyze stock structure
    console.log('\n📋 Stock Structure Analysis:');
    
    let stockFields = {
      'stock': 0,
      'qty_available': 0,
      'opening_stock': 0,
      'current_stock': 0,
      'available_stock': 0,
      'stock_quantity': 0
    };
    
    products.forEach((product, index) => {
      console.log(`\nProduct ${index + 1}: ${product.name}`);
      console.log(`  SKU: ${product.sku}`);
      console.log(`  Enable Stock: ${product.enable_stock}`);
      
      // Check all possible stock fields
      Object.keys(stockFields).forEach(field => {
        if (product[field] !== undefined && product[field] !== null) {
          const value = parseInt(product[field]) || 0;
          console.log(`  ${field}: ${value}`);
          if (value > 0) stockFields[field]++;
        }
      });
      
      // Check variations for stock
      if (product.product_variations && product.product_variations.length > 0) {
        console.log(`  Variations: ${product.product_variations.length}`);
        product.product_variations.forEach((variation, vIndex) => {
          console.log(`    Variation ${vIndex + 1}:`);
          Object.keys(stockFields).forEach(field => {
            if (variation[field] !== undefined && variation[field] !== null) {
              const value = parseInt(variation[field]) || 0;
              console.log(`      ${field}: ${value}`);
            }
          });
        });
      }
      
      // Show first few products in detail
      if (index >= 2) return;
    });
    
    console.log('\n📊 Stock Field Summary:');
    Object.entries(stockFields).forEach(([field, count]) => {
      console.log(`  ${field}: ${count} products have values`);
    });
    
    // 2. Check if stock is in a different location
    console.log('\n📋 2. Checking Stock by Location');
    
    // Try different location IDs
    const locationIds = ['21237', 'BL0001', '1'];
    
    for (const locationId of locationIds) {
      try {
        console.log(`\nChecking location: ${locationId}`);
        
        const locationProducts = await prokipService.getProducts(locationId, config.userId);
        const productsWithStock = locationProducts.filter(p => {
          const stock = parseInt(p.stock || p.qty_available || 0);
          return stock > 0;
        });
        
        console.log(`  Products in location ${locationId}: ${locationProducts.length}`);
        console.log(`  Products with stock > 0: ${productsWithStock.length}`);
        
        if (productsWithStock.length > 0) {
          console.log('  🎉 Found products with stock in this location!');
          productsWithStock.slice(0, 3).forEach(p => {
            const stock = parseInt(p.stock || p.qty_available || 0);
            console.log(`    - ${p.name} (SKU: ${p.sku}) - Stock: ${stock}`);
          });
        }
      } catch (error) {
        console.log(`  ❌ Location ${locationId} failed: ${error.message}`);
      }
    }
    
    // 3. Check if we need to initialize stock
    console.log('\n📋 3. Stock Initialization Recommendations');
    
    const sampleProduct = products[0];
    if (sampleProduct) {
      console.log(`Sample Product: ${sampleProduct.name}`);
      console.log(`  Product ID: ${sampleProduct.id}`);
      console.log(`  Enable Stock: ${sampleProduct.enable_stock}`);
      console.log(`  Current Stock Fields:`);
      
      Object.keys(stockFields).forEach(field => {
        if (sampleProduct[field] !== undefined && sampleProduct[field] !== null) {
          console.log(`    ${field}: ${sampleProduct[field]}`);
        }
      });
      
      console.log('\n💡 Recommendations:');
      console.log('1. Check if stock tracking is enabled in Prokip dashboard');
      console.log('2. Add opening stock to products in Prokip');
      console.log('3. Verify the correct location is being used');
      console.log('4. Check if products have variations with stock');
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the analysis
if (require.main === module) {
  analyzeStockStructure()
    .then(() => {
      console.log('\n✨ Stock structure analysis completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Analysis crashed:', error);
      process.exit(1);
    });
}

module.exports = { analyzeStockStructure };
