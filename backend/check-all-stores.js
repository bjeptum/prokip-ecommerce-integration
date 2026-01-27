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

async function checkAllStores() {
  try {
    console.log('🔍 Checking all connected stores...');
    
    // Get all connections
    const connections = await prisma.connection.findMany({
      where: { userId: 50 }
    });
    
    console.log(`\n📦 Found ${connections.length} connected stores:`);
    console.log('=====================================');
    
    for (const connection of connections) {
      console.log(`\n🏪 Store ${connection.id}:`);
      console.log(`   Platform: ${connection.platform}`);
      console.log(`   Store URL: ${connection.storeUrl}`);
      console.log(`   Store Name: ${connection.storeName || 'N/A'}`);
      console.log(`   Status: ${connection.status || 'N/A'}`);
      console.log(`   Created: ${connection.createdAt}`);
      
      if (connection.platform === 'woocommerce') {
        try {
          const { consumerKey, consumerSecret } = decryptCredentials(connection);
          const baseUrl = connection.storeUrl.replace(/\/$/, '');
          
          // Test connection and get product count
          const response = await axios.get(`${baseUrl}/wp-json/wc/v3/products?per_page=1`, {
            auth: {
              username: consumerKey,
              password: consumerSecret
            },
            headers: {
              'User-Agent': 'Prokip-Integration/1.0'
            }
          });
          
          const totalProducts = response.headers['x-wp-total'] || 'Unknown';
          console.log(`   ✅ Connection: SUCCESS`);
          console.log(`   📦 Products in store: ${totalProducts}`);
          
          // Get first few products to verify
          const productsResponse = await axios.get(`${baseUrl}/wp-json/wc/v3/products?per_page=3`, {
            auth: {
              username: consumerKey,
              password: consumerSecret
            }
          });
          
          console.log(`   📋 Sample products:`);
          productsResponse.data.forEach((product, index) => {
            console.log(`      ${index + 1}. ${product.name} (SKU: ${product.sku || 'N/A'})`);
          });
          
        } catch (error) {
          console.log(`   ❌ Connection: FAILED`);
          console.log(`   Error: ${error.response?.data?.message || error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('Check failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllStores();
