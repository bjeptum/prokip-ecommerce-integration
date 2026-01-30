const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');

const prisma = new PrismaClient();

/**
 * Check current Prokip products and their stock levels
 */
async function checkProkipProducts() {
  try {
    console.log('🔍 Checking current Prokip products...\n');

    // 1. Get Prokip config
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });

    if (!prokipConfig) {
      throw new Error('No Prokip config found for user 50');
    }

    console.log(`✅ Found Prokip config for location: ${prokipConfig.locationId}`);

    // 2. Get all products
    const products = await prokipService.getProducts(prokipConfig.locationId, 50);
    
    console.log(`\n📦 Found ${products.length} products in Prokip:\n`);
    
    // Sort by stock level to see which might need adjustment
    products.sort((a, b) => (b.stock || 0) - (a.stock || 0));
    
    products.forEach((product, index) => {
      const stock = product.stock || 0;
      const sku = product.sku || 'NO-SKU';
      const name = product.name || 'Unnamed Product';
      
      console.log(`${(index + 1).toString().padStart(2)}. ${(sku || 'NO-SKU').padEnd(15)} | Stock: ${(stock || 0).toString().padEnd(3)} | ${name}`);
      
      // Highlight products that might be the "air cream" or similar
      if (name.toLowerCase().includes('air') || name.toLowerCase().includes('cream')) {
        console.log(`    🎯 POSSIBLE AIR CREAM MATCH!`);
      }
      if (name.toLowerCase().includes('lotion')) {
        console.log(`    🎯 POSSIBLE LOTION MATCH!`);
      }
    });

    // 3. Look for products with stock around 67-70 (the air cream range)
    console.log(`\n🎯 Products with stock between 60-75 (possible air cream candidates):\n`);
    
    const candidates = products.filter(p => {
      const stock = p.stock || 0;
      return stock >= 60 && stock <= 75;
    });
    
    candidates.forEach(product => {
      console.log(`   ${product.sku || 'NO-SKU'} | Stock: ${product.stock || 0} | ${product.name || 'Unnamed'}`);
    });

    // 4. Show products that might need stock reduction
    console.log(`\n📊 Products with high stock levels that might need reduction:\n`);
    
    const highStock = products.filter(p => (p.stock || 0) > 50);
    
    highStock.forEach(product => {
      console.log(`   ${product.sku || 'NO-SKU'} | Stock: ${product.stock || 0} | ${product.name || 'Unnamed'}`);
    });

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  checkProkipProducts();
}

module.exports = { checkProkipProducts };
