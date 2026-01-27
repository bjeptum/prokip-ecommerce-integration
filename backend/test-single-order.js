const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { decryptCredentials } = require('./src/services/storeService');

const prisma = new PrismaClient();

async function testSingleOrder() {
  try {
    console.log('🧪 Testing with order #14213...');
    
    // Get WooCommerce connection
    const wooConnection = await prisma.connection.findFirst({ 
      where: { platform: 'woocommerce' } 
    });
    
    if (!wooConnection) {
      console.error('❌ WooCommerce connection not found');
      return;
    }
    
    // Decrypt credentials
    const { consumerKey, consumerSecret } = decryptCredentials(wooConnection);
    
    const wooHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`
    };
    
    // Test fetching the specific order
    console.log('📦 Fetching order #14213...');
    const orderResponse = await axios.get(
      `${wooConnection.storeUrl}/wp-json/wc/v3/orders/14213`,
      { headers: wooHeaders }
    );
    
    const order = orderResponse.data;
    console.log(`✅ Order found: #${order.id}`);
    console.log(`  - Status: ${order.status}`);
    console.log(`  - Date: ${order.date_created}`);
    console.log(`  - Total: ${order.total}`);
    console.log(`  - Items: ${order.line_items.length}`);
    
    // Test the date-based query that's failing
    console.log('\n📅 Testing date-based query...');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    console.log(`  Querying orders after: ${sevenDaysAgo}`);
    
    try {
      const recentOrdersResponse = await axios.get(
        `${wooConnection.storeUrl}/wp-json/wc/v3/orders?after=${sevenDaysAgo}&per_page=10&status=completed`,
        { headers: wooHeaders }
      );
      
      console.log(`✅ Found ${recentOrdersResponse.data.length} recent completed orders`);
      
    } catch (dateError) {
      console.error(`❌ Date query failed: ${dateError.message}`);
      console.error(`  Status: ${dateError.response?.status}`);
      console.error(`  Data:`, dateError.response?.data);
      
      // Try without date filter
      console.log('\n🔄 Trying without date filter...');
      const allOrdersResponse = await axios.get(
        `${wooConnection.storeUrl}/wp-json/wc/v3/orders?per_page=10&status=completed`,
        { headers: wooHeaders }
      );
      
      console.log(`✅ Found ${allOrdersResponse.data.length} completed orders (no date filter)`);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Data:`, error.response.data);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testSingleOrder();
