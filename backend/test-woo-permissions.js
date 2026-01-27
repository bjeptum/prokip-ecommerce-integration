const { PrismaClient } = require('@prisma/client');
const { getWooProducts } = require('./src/services/wooService');
const wooSecureService = require('./src/services/wooSecureService');

const prisma = new PrismaClient();

function decryptCredentials(connection) {
  let consumerKey = connection.consumerKey;
  let consumerSecret = connection.consumerSecret;
  
  // Check if credentials are encrypted (they will be JSON objects with "encrypted" field)
  if (consumerKey && typeof consumerKey === 'string' && consumerKey.startsWith('{"encrypted":')) {
    try {
      const encryptedData = JSON.parse(consumerKey);
      consumerKey = wooSecureService.decrypt(encryptedData);
      console.log('✅ Consumer Key decrypted successfully');
    } catch (error) {
      console.error('❌ Failed to decrypt Consumer Key:', error.message);
      throw new Error('Failed to decrypt Consumer Key');
    }
  }
  
  if (consumerSecret && typeof consumerSecret === 'string' && consumerSecret.startsWith('{"encrypted":')) {
    try {
      const encryptedData = JSON.parse(consumerSecret);
      consumerSecret = wooSecureService.decrypt(encryptedData);
      console.log('✅ Consumer Secret decrypted successfully');
    } catch (error) {
      console.error('❌ Failed to decrypt Consumer Secret:', error.message);
      throw new Error('Failed to decrypt Consumer Secret');
    }
  }
  
  return { consumerKey, consumerSecret };
}

async function testWooCommercePermissions() {
  try {
    console.log('Testing WooCommerce permissions...');
    
    // Get the WooCommerce connection
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
    
    console.log('Connection found:', {
      id: connection.id,
      storeUrl: connection.storeUrl,
      platform: connection.platform
    });
    
    // Decrypt credentials
    const { consumerKey, consumerSecret } = decryptCredentials(connection);
    console.log('Credentials decrypted successfully');
    
    // Test reading products (should work)
    console.log('Testing product read access...');
    try {
      const products = await getWooProducts(
        connection.storeUrl,
        consumerKey,
        consumerSecret
      );
      console.log(`✅ Successfully read ${products.length} products from WooCommerce`);
    } catch (readError) {
      console.error('❌ Failed to read products:', readError.message);
    }
    
    // Test creating a product (this might fail due to permissions)
    console.log('Testing product creation access...');
    try {
      const axios = require('axios');
      const baseUrl = connection.storeUrl.replace(/\/$/, '');
      
      const testProduct = {
        name: 'Test Product - Delete Me',
        sku: 'TEST-DELETE-' + Date.now(),
        regular_price: '1.00',
        status: 'draft'
      };
      
      const response = await axios.post(`${baseUrl}/wp-json/wc/v3/products`, testProduct, {
        auth: {
          username: consumerKey,
          password: consumerSecret
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Successfully created test product:', response.data.id);
      
      // Clean up - delete the test product
      await axios.delete(`${baseUrl}/wp-json/wc/v3/products/${response.data.id}`, {
        auth: {
          username: consumerKey,
          password: consumerSecret
        }
      });
      
      console.log('✅ Successfully deleted test product');
      console.log('🎉 WooCommerce permissions are correct!');
      
    } catch (createError) {
      console.error('❌ Failed to create product:', createError.response?.data || createError.message);
      
      if (createError.response?.status === 403) {
        console.log('🔒 Permission denied - Consumer Key needs write permissions');
        console.log('💡 Solution: Go to WooCommerce > Settings > Advanced > REST API');
        console.log('   Find your Consumer Key and ensure it has "Read/Write" permissions');
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testWooCommercePermissions();
