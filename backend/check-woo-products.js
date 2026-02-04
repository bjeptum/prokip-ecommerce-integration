const axios = require('axios');

async function checkWooCommerceProducts() {
  try {
    console.log('🧪 Checking if products were created in WooCommerce...');
    
    // Get WooCommerce credentials
    const prisma = require('./src/lib/prisma');
    const connection = await prisma.connection.findFirst({ where: { platform: 'woocommerce' } });
    
    if (!connection) {
      console.log('❌ No WooCommerce connection found');
      return;
    }
    
    // Decrypt credentials
    const { decryptCredentials } = require('./src/services/storeService');
    const decrypted = decryptCredentials(connection);
    const consumerKey = decrypted.consumerKey;
    const consumerSecret = decrypted.consumerSecret;
    
    // Test API connection
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    
    try {
      const response = await axios.get(`${connection.storeUrl}/wp-json/wc/v3/products?per_page=50`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ WooCommerce products retrieved!');
      console.log('📊 Total products:', response.data.length);
      
      // Check for recently created products
      const recentProducts = response.data.filter(p => {
        const createdDate = new Date(p.date_created);
        const now = new Date();
        const hoursDiff = (now - createdDate) / (1000 * 60 * 60);
        return hoursDiff <= 1; // Products created in last hour
      });
      
      console.log('📦 Recently created products (last hour):', recentProducts.length);
      
      if (recentProducts.length > 0) {
        console.log('\n🆕 Recent products:');
        recentProducts.slice(0, 5).forEach(product => {
          console.log(`- ${product.name} (SKU: ${product.sku}) - Status: ${product.status} - Stock: ${product.stock_quantity}`);
        });
      }
      
      // Check for specific SKUs that were pushed
      const pushedSKUs = ['4744942', '4815445', '4848961', '4922111'];
      const foundProducts = response.data.filter(p => pushedSKUs.includes(p.sku));
      
      console.log('\n🎯 Products from push operation:');
      foundProducts.forEach(product => {
        console.log(`- ${product.name} (SKU: ${product.sku})`);
        console.log(`  Status: ${product.status}`);
        console.log(`  Stock: ${product.stock_quantity}`);
        console.log(`  Price: ${product.price}`);
        console.log(`  Visible: ${product.catalog_visibility}`);
        console.log('');
      });
      
    } catch (error) {
      console.error('❌ Failed to fetch products:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkWooCommerceProducts();
