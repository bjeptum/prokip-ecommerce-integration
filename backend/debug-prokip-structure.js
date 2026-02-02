/**
 * Debug script to examine the actual Prokip API response structure
 */

const prokipService = require('./src/services/prokipService');

async function debugProkipProductStructure() {
  try {
    console.log('🔍 Debugging Prokip product structure...\n');
    
    const products = await prokipService.getProducts(null, 50);
    
    console.log(`📦 Found ${products.length} products\n`);
    
    if (products.length > 0) {
      console.log('📋 Full product structure (first product):');
      console.log(JSON.stringify(products[0], null, 2));
      
      console.log('\n🔍 Looking for stock-related fields...');
      const firstProduct = products[0];
      const allKeys = Object.keys(firstProduct);
      console.log('All fields:', allKeys);
      
      // Look for any field that might contain stock information
      const stockRelatedFields = allKeys.filter(key => 
        key.toLowerCase().includes('stock') || 
        key.toLowerCase().includes('qty') || 
        key.toLowerCase().includes('quantity') ||
        key.toLowerCase().includes('inventory') ||
        key.toLowerCase().includes('available')
      );
      
      console.log('Stock-related fields:', stockRelatedFields);
      
      // Check values for these fields
      stockRelatedFields.forEach(field => {
        console.log(`${field}:`, firstProduct[field]);
      });
      
      // Look specifically at polo shirts
      const poloShirts = products.filter(p => 
        p.name && p.name.toLowerCase().includes('polo')
      );
      
      if (poloShirts.length > 0) {
        console.log('\n👕 Polo shirt structure:');
        console.log(JSON.stringify(poloShirts[0], null, 2));
      }
      
      // Check if there's a nested structure
      if (firstProduct.product_variations) {
        console.log('\n📦 Product variations found:');
        console.log(JSON.stringify(firstProduct.product_variations, null, 2));
      }
      
      if (firstProduct.variations) {
        console.log('\n📦 Variations found:');
        console.log(JSON.stringify(firstProduct.variations, null, 2));
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugProkipProductStructure();
