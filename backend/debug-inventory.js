const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');

const prisma = new PrismaClient();

async function debugInventory() {
  try {
    console.log('🔍 Debugging Prokip inventory data...');
    
    const userId = 50;
    
    // Get Prokip products
    console.log('\n📦 Fetching Prokip products...');
    const products = await prokipService.getProducts(null, userId);
    console.log(`Found ${products.length} products`);
    
    // Get Prokip inventory
    console.log('\n📊 Fetching Prokip inventory...');
    const inventory = await prokipService.getInventory(null, userId);
    console.log(`Found ${inventory.length} inventory items`);
    
    // Show first few products with their inventory
    console.log('\n🔍 First 5 products with inventory:');
    for (let i = 0; i < Math.min(5, products.length); i++) {
      const product = products[i];
      const inventoryItem = inventory.find(item => item.sku === product.sku);
      
      console.log(`\nProduct ${i + 1}: ${product.name}`);
      console.log(`  SKU: ${product.sku}`);
      console.log(`  Price: ${product.product_variations?.[0]?.variations?.[0]?.sell_price_inc_tax || 'N/A'}`);
      
      if (inventoryItem) {
        console.log(`  Inventory Found:`);
        console.log(`    Stock: ${inventoryItem.stock || inventoryItem.qty_available || 'N/A'}`);
        console.log(`    Product ID: ${inventoryItem.product_id || 'N/A'}`);
      } else {
        console.log(`  ❌ No inventory found for this SKU`);
      }
    }
    
    // Check inventory data structure
    if (inventory.length > 0) {
      console.log('\n📋 Inventory data structure (first item):');
      console.log(JSON.stringify(inventory[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugInventory();
