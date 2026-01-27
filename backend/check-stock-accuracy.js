const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const wooSecureService = require('./src/services/wooSecureService');

const prisma = new PrismaClient();

function decryptCredentials(connection) {
  let consumerKey = connection.consumerKey;
  let consumerSecret = connection.consumerSecret;
  
  if (consumerKey && typeof consumerKey === 'string' && consumerKey.startsWith('{"encrypted":')) {
    try {
      const encryptedData = JSON.parse(consumerKey);
      consumerKey = wooSecureService.decrypt(encryptedData);
    } catch (error) {
      console.error('Failed to decrypt Consumer Key:', error.message);
    }
  }
  
  if (consumerSecret && typeof consumerSecret === 'string' && consumerSecret.startsWith('{"encrypted":')) {
    try {
      const encryptedData = JSON.parse(consumerSecret);
      consumerSecret = wooSecureService.decrypt(encryptedData);
    } catch (error) {
      console.error('Failed to decrypt Consumer Secret:', error.message);
    }
  }
  
  return { consumerKey, consumerSecret };
}

async function checkStockAccuracy() {
  try {
    console.log('🔍 Checking stock accuracy for products with inventory...');
    
    // Get Store 5 connection
    const connection = await prisma.connection.findFirst({
      where: { 
        id: 5,
        userId: 50
      }
    });
    
    if (!connection) {
      console.log('No Store 5 connection found');
      return;
    }
    
    const { consumerKey, consumerSecret } = decryptCredentials(connection);
    const baseUrl = connection.storeUrl.replace(/\/$/, '');
    
    // Get Prokip inventory
    const prokipService = require('./src/services/prokipService');
    const inventory = await prokipService.getInventory(null, 50);
    
    // Check first 5 products that have inventory
    const inventoryItems = inventory.filter(item => parseFloat(item.stock) > 0).slice(0, 5);
    
    console.log(`\n📊 Checking ${inventoryItems.length} products that should have stock:`);
    
    let allCorrect = true;
    
    for (const item of inventoryItems) {
      console.log(`\n🔍 Checking ${item.product} (SKU: ${item.sku})`);
      console.log(`  📋 Expected stock: ${item.stock}`);
      
      try {
        // Get product from WooCommerce
        const productResponse = await axios.get(`${baseUrl}/wp-json/wc/v3/products`, {
          auth: { username: consumerKey, password: consumerSecret },
          params: { sku: item.sku, limit: 1 }
        });
        
        if (productResponse.data.length > 0) {
          const product = productResponse.data[0];
          console.log(`  📦 Actual stock: ${product.stock_quantity}`);
          console.log(`  📈 Stock status: ${product.stock_status}`);
          
          if (parseFloat(product.stock_quantity) === parseFloat(item.stock)) {
            console.log(`  ✅ CORRECT - Stock matches!`);
          } else {
            console.log(`  ❌ MISMATCH - Stock should be ${item.stock}`);
            allCorrect = false;
          }
        } else {
          console.log(`  ❌ Product not found in WooCommerce`);
          allCorrect = false;
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        allCorrect = false;
      }
    }
    
    console.log(`\n🎯 Summary:`);
    if (allCorrect) {
      console.log(`✅ All checked products have CORRECT stock levels!`);
      console.log(`🎉 The inventory sync is working perfectly!`);
    } else {
      console.log(`❌ Some products have incorrect stock levels`);
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkStockAccuracy();
