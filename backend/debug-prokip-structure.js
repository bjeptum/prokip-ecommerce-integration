const prisma = require('./src/lib/prisma');
const prokipService = require('./src/services/prokipService');

async function debugProkipProducts() {
  try {
    console.log('🧪 Debugging Prokip products structure...');
    
    // Get user ID from Prokip config
    const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId: 2 } });
    
    if (!prokipConfig) {
      console.log('❌ No Prokip config found for user 2');
      return;
    }
    
    console.log('✅ Found Prokip config for user 2');
    
    // Get products directly
    const products = await prokipService.getProducts(null, 2);
    
    console.log(`📊 Total products: ${products.length}`);
    
    // Show first few products with full structure
    console.log('\n📦 First 3 products with structure:');
    products.slice(0, 3).forEach((product, index) => {
      console.log(`\n${index + 1}. ${product.name}`);
      console.log(`   SKU: ${product.sku}`);
      console.log(`   Stock: ${product.stock || product.qty_available || 'N/A'}`);
      console.log(`   Has variations: ${!!(product.product_variations && product.product_variations.length > 0)}`);
      
      if (product.product_variations && product.product_variations.length > 0) {
        console.log(`   Variations count: ${product.product_variations.length}`);
        product.product_variations.slice(0, 2).forEach((variation, vIndex) => {
          console.log(`     Variation ${vIndex + 1}: ${variation.name}`);
          console.log(`       Stock: ${variation.stock || variation.qty_available || 'N/A'}`);
          console.log(`       Price structure:`, Object.keys(variation));
          if (variation.variations && variation.variations.length > 0) {
            console.log(`       Nested variations: ${variation.variations.length}`);
            variation.variations.slice(0, 1).forEach(nested => {
              console.log(`         Nested: ${nested.name} - Price: ${nested.sell_price_inc_tax} - Stock: ${nested.stock || nested.qty_available}`);
            });
          }
        });
      }
      
      console.log(`   Price fields:`, Object.keys(product).filter(k => k.includes('price')));
    });
    
    // Check inventory data
    console.log('\n🧪 Checking inventory data...');
    try {
      const inventory = await prokipService.getInventory(null, 2);
      console.log(`📊 Inventory items: ${inventory.length}`);
      
      console.log('\n📦 First 3 inventory items:');
      inventory.slice(0, 3).forEach((item, index) => {
        console.log(`${index + 1}. SKU: ${item.sku} - Stock: ${item.stock || item.qty_available} - Product ID: ${item.product_id}`);
      });
      
    } catch (inventoryError) {
      console.error('❌ Inventory fetch failed:', inventoryError.message);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugProkipProducts();
