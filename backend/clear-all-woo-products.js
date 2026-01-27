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

async function clearAllWooCommerceProducts() {
  try {
    console.log('🧹 Clearing ALL products from WooCommerce...');
    
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
    let page = 1;
    let totalDeleted = 0;
    let hasMore = true;
    
    while (hasMore) {
      const response = await axios.get(`${baseUrl}/wp-json/wc/v3/products?per_page=100&page=${page}`, {
        auth: {
          username: consumerKey,
          password: consumerSecret
        }
      });
      
      const products = response.data;
      
      if (products.length === 0) {
        hasMore = false;
        break;
      }
      
      console.log(`Found ${products.length} products on page ${page}`);
      
      // Delete all products on this page
      for (const product of products) {
        try {
          await axios.delete(`${baseUrl}/wp-json/wc/v3/products/${product.id}`, {
            auth: {
              username: consumerKey,
              password: consumerSecret
            }
          });
          console.log(`🗑️ Deleted: ${product.name} (SKU: ${product.sku || 'N/A'})`);
          totalDeleted++;
        } catch (deleteError) {
          console.error(`Failed to delete product ${product.id}:`, deleteError.message);
        }
      }
      
      page++;
    }
    
    console.log(`✅ Cleanup complete! Deleted ${totalDeleted} products from WooCommerce`);
    
  } catch (error) {
    console.error('Clear products failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

clearAllWooCommerceProducts();
