/**
 * Test to verify WooCommerce products and debug the product push issue
 */

const axios = require('axios');
const prisma = require('./src/lib/prisma');

async function debugProductPush() {
  try {
    console.log('🔍 Debugging product push issue...\n');
    
    // 1. Check the connection details
    const connection = await prisma.connection.findFirst({
      where: { id: 10, userId: 50 }
    });
    
    if (!connection) {
      throw new Error('Connection not found');
    }
    
    console.log('✅ Connection found:');
    console.log('   Platform:', connection.platform);
    console.log('   Store URL:', connection.storeUrl);
    console.log('   Store Name:', connection.storeName);
    
    // 2. Check WooCommerce products directly
    console.log('\n🛒 Checking WooCommerce products directly...');
    
    const { decryptCredentials } = require('./src/services/storeService');
    const { consumerKey, consumerSecret } = decryptCredentials(connection);
    
    const wooResponse = await axios.get(`${connection.storeUrl}/wp-json/wc/v3/products`, {
      auth: {
        username: consumerKey,
        password: consumerSecret
      },
      params: {
        per_page: 20
      }
    });
    
    console.log(`✅ Found ${wooResponse.data.length} products in WooCommerce`);
    
    // Look for recently created products
    const recentProducts = wooResponse.data.filter(p => {
      const createdDate = new Date(p.date_created);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return createdDate > oneHourAgo;
    });
    
    console.log(`📦 Recently created products (last hour): ${recentProducts.length}`);
    
    if (recentProducts.length > 0) {
      console.log('Recent products:');
      recentProducts.forEach((p, index) => {
        console.log(`   ${index + 1}. ${p.name} (SKU: ${p.sku}) - Status: ${p.status}`);
        console.log(`      Created: ${p.date_created}`);
        console.log(`      Stock: ${p.stock_quantity || 0}`);
        console.log(`      Price: ${p.regular_price || 0}`);
      });
    }
    
    // 3. Check inventory logs for recent pushes
    console.log('\n📋 Checking inventory logs...');
    const recentLogs = await prisma.inventoryLog.findMany({
      where: { 
        connectionId: 10,
        lastSynced: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      },
      orderBy: { lastSynced: 'desc' },
      take: 10
    });
    
    console.log(`📝 Recent inventory logs (last hour): ${recentLogs.length}`);
    
    if (recentLogs.length > 0) {
      console.log('Recent logs:');
      recentLogs.forEach((log, index) => {
        console.log(`   ${index + 1}. ${log.productName} (SKU: ${log.sku})`);
        console.log(`      Quantity: ${log.quantity}`);
        console.log(`      Last Synced: ${log.lastSynced}`);
      });
    }
    
    // 4. Test the setup/products endpoint directly
    console.log('\n🧪 Testing setup/products endpoint...');
    
    const prokipConfig = await prisma.prokipConfig.findFirst({ 
      where: { userId: 50 } 
    });
    
    if (prokipConfig?.token) {
      const setupResponse = await axios.post('http://localhost:3000/setup/products', {
        method: 'push',
        connectionId: 10
      }, {
        headers: {
          'Authorization': `Bearer ${prokipConfig.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      console.log('✅ Setup/products response:', setupResponse.data);
    }
    
    console.log('\n🎯 Analysis:');
    
    if (recentProducts.length === 0 && recentLogs.length > 0) {
      console.log('⚠️ Products are being logged but may not be appearing in WooCommerce dashboard.');
      console.log('💡 Possible causes:');
      console.log('   - Products are created with "draft" status instead of "publish"');
      console.log('   - WooCommerce caching issues');
      console.log('   - Permission issues preventing dashboard visibility');
      console.log('   - Products are created but not indexed properly');
    } else if (recentProducts.length > 0) {
      console.log('✅ Products are being created successfully in WooCommerce');
      console.log('💡 If not visible in dashboard, try:');
      console.log('   - Refreshing the WooCommerce dashboard');
      console.log('   - Checking product status (draft vs published)');
      console.log('   - Looking in "All Products" vs "Published" filter');
    } else {
      console.log('❌ No recent products found - push may be failing silently');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

debugProductPush();
