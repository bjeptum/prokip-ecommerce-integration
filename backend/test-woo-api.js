const axios = require('axios');
const crypto = require('crypto');

async function testWooCommerceAPI() {
  try {
    console.log('🧪 Testing WooCommerce API connection...');
    
    // Get WooCommerce credentials from database
    const prisma = require('./src/lib/prisma');
    const connection = await prisma.connection.findFirst({ where: { platform: 'woocommerce' } });
    
    if (!connection) {
      console.log('❌ No WooCommerce connection found');
      return;
    }
    
    console.log('🔧 Testing with Consumer Key/Secret...');
    
    // Decrypt credentials
    const { decryptCredentials } = require('./src/services/storeService');
    const decrypted = decryptCredentials(connection);
    const consumerKey = decrypted.consumerKey;
    const consumerSecret = decrypted.consumerSecret;
    
    console.log('🔑 Credentials decrypted successfully');
    
    // Test basic API connection
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(16).toString('hex');
    
    // Test with basic auth first
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    
    console.log('🌐 Testing WooCommerce API...');
    
    try {
      const response = await axios.get(`${connection.storeUrl}/wp-json/wc/v3/products`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      console.log('✅ WooCommerce API successful!');
      console.log('📊 Products found:', response.data.length);
      console.log('📦 First product:', response.data[0]?.name || 'none');
      
    } catch (error) {
      console.error('❌ WooCommerce API failed:');
      console.error('📊 Status:', error.response?.status);
      console.error('📦 Error:', error.response?.data);
      
      if (error.response?.status === 401) {
        console.log('\n🔧 SOLUTION: The Consumer Key/Secret need proper permissions in WooCommerce:');
        console.log('1. Go to WooCommerce → Settings → Advanced → REST API');
        console.log('2. Edit the existing API key or create a new one');
        console.log('3. Make sure it has these permissions:');
        console.log('   - Read: ✓ (for products, orders)');
        console.log('   - Write: ✓ (for creating products, updating stock)');
        console.log('   - Read/Write: ✓ (for full sync functionality)');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testWooCommerceAPI();
