const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function debugInventoryDetails() {
  try {
    console.log('🔍 Debugging inventory update details...');
    
    // Get Prokip config for authentication
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });
    
    if (!prokipConfig?.token) {
      console.log('No Prokip config found');
      return;
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`
    };
    
    // Get Prokip inventory
    const prokipService = require('./src/services/prokipService');
    const inventory = await prokipService.getInventory(null, 50);
    
    console.log(`\n📋 Prokip inventory items: ${inventory.length}`);
    
    // Get WooCommerce products
    const productsResponse = await axios.get('http://localhost:3000/stores/my-store/products?connectionId=5', {
      headers
    });
    
    const products = productsResponse.data.products || [];
    console.log(`📦 WooCommerce products: ${products.length}`);
    
    // Check which Prokip inventory items have matching WooCommerce products
    console.log('\n🔍 Checking inventory matches:');
    let matchedItems = 0;
    let unmatchedItems = 0;
    
    for (const inventoryItem of inventory.slice(0, 10)) {
      const matchingProduct = products.find(p => p.sku === inventoryItem.sku);
      
      if (matchingProduct) {
        matchedItems++;
        console.log(`✅ ${inventoryItem.sku} - ${inventoryItem.product} - Found in WooCommerce (ID: ${matchingProduct.id})`);
        console.log(`   Prokip stock: ${inventoryItem.stock}, Woo stock: ${matchingProduct.stock_quantity}`);
      } else {
        unmatchedItems++;
        console.log(`❌ ${inventoryItem.sku} - ${inventoryItem.product} - NOT found in WooCommerce`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`✅ Matched items: ${matchedItems}`);
    console.log(`❌ Unmatched items: ${unmatchedItems}`);
    
    if (unmatchedItems > 0) {
      console.log(`\n⚠️ ISSUE FOUND: Some Prokip inventory items don't exist in WooCommerce!`);
      console.log(`This would cause "undefined" errors when trying to update stock.`);
    }
    
    // Test a specific update for a matched product
    const testInventoryItem = inventory.find(item => item.sku === '4848961');
    const testProduct = products.find(p => p.sku === '4848961');
    
    if (testInventoryItem && testProduct) {
      console.log(`\n🧪 Testing direct inventory update for Hair cream...`);
      
      try {
        // Call the update function directly
        const { updateInventoryInStore } = require('./src/services/storeService');
        const connection = await prisma.connection.findFirst({
          where: { id: 5, userId: 50 }
        });
        
        const result = await updateInventoryInStore(connection, '4848961', 73);
        console.log(`✅ Direct update result:`, result);
        
        // Check if it actually updated
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const checkResponse = await axios.get('http://localhost:3000/stores/my-store/products?connectionId=5', {
          headers
        });
        
        const updatedProduct = checkResponse.data.products?.find(p => p.sku === '4848961');
        if (updatedProduct) {
          console.log(`📦 Stock after direct update: ${updatedProduct.stock_quantity}`);
          console.log(`🔄 Update ${parseInt(updatedProduct.stock_quantity) === 73 ? 'SUCCESS' : 'FAILED'}`);
        }
        
      } catch (error) {
        console.error('❌ Direct update failed:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugInventoryDetails();
