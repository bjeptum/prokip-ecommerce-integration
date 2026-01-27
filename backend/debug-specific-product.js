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

async function debugSpecificProduct() {
  try {
    console.log('🔍 Debugging specific product inventory...');
    
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
    
    // Check product SKU 4744942 (should have 15 stock)
    const sku = '4744942';
    console.log(`\n🔍 Checking product SKU: ${sku}`);
    
    // Get product from WooCommerce
    const productResponse = await axios.get(`${baseUrl}/wp-json/wc/v3/products`, {
      auth: { username: consumerKey, password: consumerSecret },
      params: { sku: sku, limit: 1 }
    });
    
    if (productResponse.data.length > 0) {
      const product = productResponse.data[0];
      console.log(`✅ Found product: ${product.name}`);
      console.log(`📦 Current stock_quantity: ${product.stock_quantity}`);
      console.log(`📊 Manage stock: ${product.manage_stock}`);
      console.log(`📈 Stock status: ${product.stock_status}`);
      
      // Get Prokip inventory for this SKU
      const prokipService = require('./src/services/prokipService');
      const inventory = await prokipService.getInventory(null, 50);
      const inventoryItem = inventory.find(item => item.sku === sku);
      
      if (inventoryItem) {
        console.log(`\n📋 Prokip inventory data:`);
        console.log(`  Stock: ${inventoryItem.stock}`);
        console.log(`  Product ID: ${inventoryItem.product_id}`);
        
        // Update the product stock directly
        console.log(`\n🔄 Updating product stock...`);
        const updateResponse = await axios.put(`${baseUrl}/wp-json/wc/v3/products/${product.id}`, {
          manage_stock: true,
          stock_quantity: parseFloat(inventoryItem.stock)
        }, {
          auth: { username: consumerKey, password: consumerSecret },
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Prokip-Integration/1.0'
          }
        });
        
        console.log(`✅ Stock updated successfully`);
        console.log(`📦 New stock_quantity: ${updateResponse.data.stock_quantity}`);
        console.log(`📈 New stock status: ${updateResponse.data.stock_status}`);
      } else {
        console.log(`❌ No inventory data found for SKU ${sku}`);
      }
    } else {
      console.log(`❌ Product not found in WooCommerce`);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugSpecificProduct();
