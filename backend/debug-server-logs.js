const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function debugServerLogs() {
  try {
    console.log('🔍 DEBUGGING: Server logs for inventory sync');
    console.log('=' .repeat(60));
    
    // Test the exact Prokip service calls that are failing
    console.log('\n🧪 1. TESTING PROKIP SERVICE CALLS DIRECTLY:');
    console.log('-'.repeat(50));
    
    const prokipService = require('./src/services/prokipService');
    
    try {
      console.log('Testing getInventory with userId 50...');
      const inventory = await prokipService.getInventory(null, 50);
      console.log('✅ getInventory successful:', inventory.length, 'items');
      
      console.log('Testing getProducts with userId 50...');
      const products = await prokipService.getProducts(null, 50);
      console.log('✅ getProducts successful:', products.length, 'items');
      
      // Test the updateInventoryInStore function
      console.log('\n🧪 2. TESTING UPDATE INVENTORY IN STORE:');
      console.log('-'.repeat(50));
      
      const { updateInventoryInStore } = require('./src/services/storeService');
      
      // Get connection 6
      const connection = await prisma.connection.findUnique({
        where: { id: 6 }
      });
      
      if (connection) {
        console.log('✅ Connection 6 found');
        
        // Test with a sample product
        if (products.length > 0) {
          const sampleProduct = products[0];
          const sampleStock = inventory.find(i => i.sku === sampleProduct.sku);
          
          if (sampleStock) {
            console.log(`Testing update for SKU: ${sampleProduct.sku}`);
            console.log(`Quantity: ${sampleStock.stock || sampleStock.qty_available || 0}`);
            
            try {
              await updateInventoryInStore(connection, sampleProduct.sku, parseInt(sampleStock.stock || sampleStock.qty_available || 0));
              console.log('✅ updateInventoryInStore successful');
            } catch (updateError) {
              console.log('❌ updateInventoryInStore failed:', updateError.message);
              console.log('This might be the cause of the 500 error');
            }
          }
        }
      }
      
    } catch (error) {
      console.log('❌ Prokip service test failed:', error.message);
      console.log('Stack:', error.stack);
    }
    
    // Test the complete sync logic manually
    console.log('\n🧪 3. TESTING COMPLETE SYNC LOGIC:');
    console.log('-'.repeat(50));
    
    try {
      const connection = await prisma.connection.findUnique({
        where: { id: 6 }
      });
      
      if (connection) {
        const inventory = await prokipService.getInventory(null, 50);
        const products = await prokipService.getProducts(null, 50);
        const { updateInventoryInStore } = require('./src/services/storeService');
        
        let successCount = 0;
        let errorCount = 0;
        const results = [];
        
        console.log(`Processing ${products.length} products...`);
        
        for (let i = 0; i < Math.min(3, products.length); i++) { // Test first 3 products
          const product = products[i];
          const sku = product.sku;
          
          if (!sku) {
            console.log(`⏭️ Product ${i} has no SKU, skipping`);
            continue;
          }
          
          const stockItem = inventory.find(inv => inv.sku === sku);
          
          if (!stockItem) {
            console.log(`⏭️ No inventory data for SKU ${sku}, skipping`);
            continue;
          }
          
          const quantity = stockItem?.stock || stockItem?.qty_available || 0;
          const price = product.product_variations?.[0]?.variations?.[0]?.sell_price_inc_tax || 0;
          
          console.log(`Processing SKU ${sku}: qty=${quantity}, price=${price}`);
          
          try {
            let storeUpdateSuccess = false;
            try {
              await updateInventoryInStore(connection, sku, parseInt(quantity));
              storeUpdateSuccess = true;
              console.log(`✅ Store update successful for SKU ${sku}`);
            } catch (storeError) {
              console.log(`❌ Store update failed for SKU ${sku}:`, storeError.message);
            }
            
            // Update inventory log
            const existingLog = await prisma.inventoryLog.findFirst({
              where: {
                connectionId: connection.id,
                sku: sku
              }
            });
            
            if (existingLog) {
              await prisma.inventoryLog.update({
                where: { id: existingLog.id },
                data: {
                  quantity: parseInt(quantity),
                  price: parseFloat(price),
                  lastSync: new Date()
                }
              });
            } else {
              await prisma.inventoryLog.create({
                data: {
                  connectionId: connection.id,
                  productId: product.id?.toString() || sku,
                  sku: sku,
                  quantity: parseInt(quantity),
                  price: parseFloat(price),
                  lastSync: new Date()
                }
              });
            }
            
            successCount++;
            results.push({ sku, status: 'success', quantity, price });
            
          } catch (error) {
            console.log(`❌ Failed to sync SKU ${sku}:`, error.message);
            errorCount++;
            results.push({ sku, status: 'error', error: error.message });
          }
        }
        
        console.log('\n📊 MANUAL SYNC RESULTS:');
        console.log(`✅ Success: ${successCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log('📋 Results:', results);
        
      }
      
    } catch (error) {
      console.log('❌ Manual sync test failed:', error.message);
      console.log('Stack:', error.stack);
    }
    
    console.log('\n🎯 CONCLUSION:');
    console.log('-'.repeat(50));
    console.log('The issue is likely in one of these areas:');
    console.log('1. updateInventoryInStore function failing');
    console.log('2. Database operations failing');
    console.log('3. Network connectivity issues');
    console.log('4. Authentication issues with WooCommerce');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugServerLogs();
