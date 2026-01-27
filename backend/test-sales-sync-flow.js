const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testSalesSyncFlow() {
  try {
    console.log('🔄 Testing complete sales->sync flow...');
    
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
    
    // Step 1: Get current inventory state
    console.log('\n📊 Step 1: Current inventory state...');
    const beforeSync = await axios.get('http://localhost:3000/stores/my-store/products?connectionId=5', {
      headers
    });
    
    const productsBefore = beforeSync.data.products || [];
    
    // Focus on a specific product to track
    const testProduct = productsBefore.find(p => p.sku === '4848961'); // Hair cream - should have 76
    if (!testProduct) {
      console.log('❌ Test product Hair cream (4848961) not found');
      return;
    }
    
    console.log(`🔍 Tracking product: ${testProduct.name} (SKU: ${testProduct.sku})`);
    console.log(`📦 Current stock in WooCommerce: ${testProduct.stock_quantity}`);
    
    // Step 2: Get Prokip inventory for this product
    console.log('\n📋 Step 2: Prokip inventory data...');
    const prokipService = require('./src/services/prokipService');
    const inventory = await prokipService.getInventory(null, 50);
    const prokipItem = inventory.find(item => item.sku === '4848961');
    
    if (prokipItem) {
      console.log(`📊 Prokip stock: ${prokipItem.stock}`);
      console.log(`🔄 Should update WooCommerce from ${testProduct.stock_quantity} to ${prokipItem.stock}`);
    } else {
      console.log('❌ No Prokip inventory data for Hair cream');
      return;
    }
    
    // Step 3: Force inventory sync
    console.log('\n🔄 Step 3: Force inventory sync...');
    const syncResponse = await axios.post('http://localhost:3000/sync/inventory', {
      connectionId: 5
    }, {
      headers
    });
    
    console.log(`Sync result: ${syncResponse.data.success ? 'SUCCESS' : 'FAILED'}`);
    
    // Check if our specific product was updated
    const syncResult = syncResponse.data.results?.find(r => r.sku === '4848961');
    if (syncResult) {
      console.log(`📦 Sync result for Hair cream: ${syncResult.status}`);
      console.log(`📊 Quantity: ${syncResult.quantity}`);
      console.log(`🏪 Store updated: ${syncResult.storeUpdated}`);
      console.log(`💬 Message: ${syncResult.message}`);
    } else {
      console.log('❌ No sync result found for Hair cream');
    }
    
    // Step 4: Wait and check WooCommerce again
    console.log('\n⏱️ Step 4: Wait 3 seconds and check WooCommerce...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const afterSync = await axios.get('http://localhost:3000/stores/my-store/products?connectionId=5', {
      headers
    });
    
    const productsAfter = afterSync.data.products || [];
    const productAfter = productsAfter.find(p => p.sku === '4848961');
    
    if (productAfter) {
      console.log(`📦 WooCommerce stock after sync: ${productAfter.stock_quantity}`);
      
      if (parseInt(productAfter.stock_quantity) === parseInt(prokipItem.stock)) {
        console.log('✅ SUCCESS! Stock updated correctly');
      } else {
        console.log(`❌ FAILED! Stock still ${productAfter.stock_quantity}, should be ${prokipItem.stock}`);
      }
    } else {
      console.log('❌ Product not found after sync');
    }
    
    // Step 5: Check if there are any other products with mismatched stock
    console.log('\n🔍 Step 5: Check for other stock mismatches...');
    const mismatches = [];
    
    for (const inventoryItem of inventory) {
      const product = productsAfter.find(p => p.sku === inventoryItem.sku);
      if (product) {
        const prokipStock = parseInt(inventoryItem.stock) || 0;
        const wooStock = parseInt(product.stock_quantity) || 0;
        
        if (prokipStock !== wooStock) {
          mismatches.push({
            sku: inventoryItem.sku,
            name: inventoryItem.product,
            prokipStock,
            wooStock,
            difference: prokipStock - wooStock
          });
        }
      }
    }
    
    if (mismatches.length > 0) {
      console.log(`❌ Found ${mismatches.length} products with mismatched stock:`);
      mismatches.slice(0, 5).forEach(mismatch => {
        console.log(`  ${mismatch.sku} (${mismatch.name}): Prokip=${mismatch.prokipStock}, Woo=${mismatch.wooStock}, Diff=${mismatch.difference}`);
      });
    } else {
      console.log('✅ All products have matching stock levels!');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testSalesSyncFlow();
