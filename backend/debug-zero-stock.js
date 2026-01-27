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

async function debugZeroStock() {
  try {
    console.log('🔍 Debugging products with 0 stock...');
    
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
    
    console.log(`📊 Found ${inventory.length} inventory items in Prokip`);
    
    // Check a few products that should have 0 stock
    const zeroStockSkus = ['4874344', '5456003', '5417022'];
    
    for (const sku of zeroStockSkus) {
      console.log(`\n🔍 Checking SKU: ${sku}`);
      
      // Get product from WooCommerce
      try {
        const productResponse = await axios.get(`${baseUrl}/wp-json/wc/v3/products`, {
          auth: { username: consumerKey, password: consumerSecret },
          params: { sku: sku, limit: 1 }
        });
        
        if (productResponse.data.length > 0) {
          const product = productResponse.data[0];
          console.log(`  ✅ WooCommerce: ${product.name}`);
          console.log(`  📦 Stock: ${product.stock_quantity}`);
          console.log(`  📈 Status: ${product.stock_status}`);
          
          // Check Prokip inventory
          const inventoryItem = inventory.find(item => item.sku === sku);
          if (inventoryItem) {
            console.log(`  📋 Prokip Stock: ${inventoryItem.stock}`);
            console.log(`  🔄 Should be updated to: ${inventoryItem.stock}`);
          } else {
            console.log(`  ❌ No Prokip inventory data found`);
            console.log(`  🔄 Will remain at 0 (correct)`);
          }
        } else {
          console.log(`  ❌ Product not found in WooCommerce`);
        }
      } catch (error) {
        console.log(`  ❌ Error checking product: ${error.message}`);
      }
    }
    
    // Show all Prokip SKUs with stock > 0
    console.log(`\n📋 Prokip items with stock > 0:`);
    inventory.filter(item => parseFloat(item.stock) > 0).forEach(item => {
      console.log(`  ${item.sku}: ${item.stock} - ${item.product}`);
    });
    
  } catch (error) {
    console.error('❌ Debug failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugZeroStock();
