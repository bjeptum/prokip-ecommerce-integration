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

async function cleanupWooCommerceTestProducts() {
  try {
    console.log('🧹 Cleaning up test products from WooCommerce...');
    
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
    
    // Get all products and delete test ones
    const response = await axios.get(`${baseUrl}/wp-json/wc/v3/products?per_page=100`, {
      auth: {
        username: consumerKey,
        password: consumerSecret
      }
    });
    
    const products = response.data;
    console.log(`Found ${products.length} products in WooCommerce`);
    
    let deletedCount = 0;
    for (const product of products) {
      // Delete products with test SKUs or recently created ones
      if (product.sku && (
        product.sku.startsWith('SAMPLE') || 
        product.sku.startsWith('TEST-') ||
        product.name.includes('Sample Product') ||
        product.name.includes('Test Product')
      )) {
        try {
          await axios.delete(`${baseUrl}/wp-json/wc/v3/products/${product.id}`, {
            auth: {
              username: consumerKey,
              password: consumerSecret
            }
          });
          console.log(`🗑️ Deleted test product: ${product.name} (SKU: ${product.sku})`);
          deletedCount++;
        } catch (deleteError) {
          console.error(`Failed to delete product ${product.sku}:`, deleteError.message);
        }
      }
    }
    
    console.log(`✅ Cleanup complete! Deleted ${deletedCount} test products`);
    
  } catch (error) {
    console.error('Cleanup failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupWooCommerceTestProducts();
