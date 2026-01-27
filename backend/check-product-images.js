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

async function checkProductImages() {
  try {
    console.log('🖼️ Checking product images...');
    
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
    
    // Get first 10 products to check images
    const response = await axios.get(`${baseUrl}/wp-json/wc/v3/products?per_page=10`, {
      auth: {
        username: consumerKey,
        password: consumerSecret
      }
    });
    
    const products = response.data;
    console.log(`\n📦 Checking images for ${products.length} products:`);
    console.log('=====================================');
    
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   SKU: ${product.sku || 'N/A'}`);
      console.log(`   Images: ${product.images.length}`);
      
      if (product.images.length > 0) {
        product.images.forEach((image, imgIndex) => {
          console.log(`     Image ${imgIndex + 1}: ${image.src}`);
          console.log(`     Alt: ${image.alt || 'N/A'}`);
        });
      } else {
        console.log('   ⚠️ No images found');
      }
      console.log('---');
    });
    
  } catch (error) {
    console.error('Check failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkProductImages();
