/**
 * Check if products are being created with wrong status or already exist
 */

const axios = require('axios');
const prisma = require('./src/lib/prisma');

async function checkProductStatus() {
  try {
    console.log('🔍 Checking product creation status...\n');
    
    const connection = await prisma.connection.findFirst({
      where: { id: 10, userId: 50 }
    });
    
    const { decryptCredentials } = require('./src/services/storeService');
    const { consumerKey, consumerSecret } = decryptCredentials(connection);
    
    // Get all WooCommerce products with more details
    const wooResponse = await axios.get(`${connection.storeUrl}/wp-json/wc/v3/products`, {
      auth: {
        username: consumerKey,
        password: consumerSecret
      },
      params: {
        per_page: 50,
        status: 'any' // Get all statuses including draft, pending, etc.
      }
    });
    
    console.log(`📊 Total products in WooCommerce (all statuses): ${wooResponse.data.length}`);
    
    // Group by status
    const statusGroups = {};
    wooResponse.data.forEach(p => {
      statusGroups[p.status] = (statusGroups[p.status] || 0) + 1;
    });
    
    console.log('\n📈 Products by status:');
    Object.entries(statusGroups).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} products`);
    });
    
    // Check for draft products
    const draftProducts = wooResponse.data.filter(p => p.status === 'draft');
    if (draftProducts.length > 0) {
      console.log('\n📝 Draft products (not visible in main dashboard):');
      draftProducts.slice(0, 5).forEach((p, index) => {
        console.log(`   ${index + 1}. ${p.name} (SKU: ${p.sku})`);
        console.log(`      Created: ${p.date_created}`);
        console.log(`      Status: ${p.status}`);
      });
    }
    
    // Check recent products (last 24 hours)
    const recentProducts = wooResponse.data.filter(p => {
      const createdDate = new Date(p.date_created);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return createdDate > oneDayAgo;
    });
    
    console.log(`\n🕐 Recent products (last 24 hours): ${recentProducts.length}`);
    if (recentProducts.length > 0) {
      recentProducts.forEach((p, index) => {
        console.log(`   ${index + 1}. ${p.name} (SKU: ${p.sku})`);
        console.log(`      Status: ${p.status}`);
        console.log(`      Created: ${p.date_created}`);
        console.log(`      Visible: ${p.status === 'publish' ? 'Yes' : 'No'}`);
      });
    }
    
    // Check specific products from inventory logs
    console.log('\n🔍 Checking specific products from recent sync:');
    const recentLogs = await prisma.inventoryLog.findMany({
      where: { 
        connectionId: 10,
        lastSynced: {
          gte: new Date(Date.now() - 2 * 60 * 60 * 1000) // Last 2 hours
        }
      },
      orderBy: { lastSynced: 'desc' },
      take: 5
    });
    
    for (const log of recentLogs) {
      const wooProduct = wooResponse.data.find(p => p.sku === log.sku);
      if (wooProduct) {
        console.log(`✅ ${log.productName} (SKU: ${log.sku}):`);
        console.log(`   Status: ${wooProduct.status}`);
        console.log(`   WooCommerce ID: ${wooProduct.id}`);
        console.log(`   Stock: ${wooProduct.stock_quantity || 0}`);
        console.log(`   Price: ${wooProduct.regular_price || 0}`);
        console.log(`   Visible: ${wooProduct.status === 'publish' ? 'Yes' : 'No'}`);
      } else {
        console.log(`❌ ${log.productName} (SKU: ${log.sku}): NOT FOUND in WooCommerce`);
      }
    }
    
    console.log('\n💡 Recommendations:');
    
    if (draftProducts.length > 0) {
      console.log('🔧 Found draft products! These need to be published:');
      console.log('   - Draft products are not visible in the main dashboard');
      console.log('   - They appear in "All Products" with "Draft" status');
      console.log('   - Solution: Update product status to "publish"');
    }
    
    if (recentProducts.length === 0) {
      console.log('📝 No recent products created - checking if updates only:');
      console.log('   - Products may already exist and are being updated');
      console.log('   - Check if stock quantities are being updated correctly');
      console.log('   - Verify product visibility in WooCommerce dashboard');
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  }
}

checkProductStatus();
