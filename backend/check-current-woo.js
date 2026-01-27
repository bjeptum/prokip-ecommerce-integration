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

async function checkCurrentWooCommerce() {
  try {
    console.log('🔍 Checking current WooCommerce products...');
    
    // Get WooCommerce connection
    const connection = await prisma.connection.findFirst({
      where: { 
        platform: 'woocommerce',
        userId: 50
      }
    });
    
    if (!connection) {
      console.log('No WooCommerce connection found');
      return;
    }
    
    const { consumerKey, consumerSecret } = decryptCredentials(connection);
    const baseUrl = connection.storeUrl.replace(/\/$/, '');
    
    // Get all products
    const response = await axios.get(`${baseUrl}/wp-json/wc/v3/products?per_page=100`, {
      auth: {
        username: consumerKey,
        password: consumerSecret
      }
    });
    
    const products = response.data;
    console.log(`\n📦 Found ${products.length} products currently in WooCommerce:`);
    console.log('=====================================');
    
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   ID: ${product.id}`);
      console.log(`   SKU: ${product.sku || 'N/A'}`);
      console.log(`   Price: ${product.price || 'N/A'}`);
      console.log(`   Stock: ${product.stock_quantity || 'N/A'}`);
      console.log(`   Status: ${product.status}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Check failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkCurrentWooCommerce();
