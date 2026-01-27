/**
 * Check for very recent orders and specific products
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

async function checkVeryRecentOrders() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Checking for very recent orders and specific products...\n');

    // Get WooCommerce connection
    const wooConnection = await prisma.connection.findFirst({ where: { platform: 'woocommerce' } });
    if (!wooConnection) {
      console.error('❌ No WooCommerce connection found');
      return;
    }

    // Decrypt credentials
    const { decryptCredentials } = require('./src/services/storeService');
    const { consumerKey, consumerSecret } = decryptCredentials(wooConnection);

    const wooHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`
    };

    // Check for orders in the last 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    console.log(`📊 Fetching orders from last 2 hours since: ${twoHoursAgo}`);

    const [completedOrders, processingOrders] = await Promise.all([
      axios.get(
        `${wooConnection.storeUrl}/wp-json/wc/v3/orders?after=${twoHoursAgo}&per_page=20&status=completed`,
        { headers: wooHeaders }
      ),
      axios.get(
        `${wooConnection.storeUrl}/wp-json/wc/v3/orders?after=${twoHoursAgo}&per_page=20&status=processing`,
        { headers: wooHeaders }
      )
    ]);

    const allOrders = [...completedOrders.data, ...processingOrders.data];
    console.log(`📦 Found ${allOrders.length} orders in last 2 hours`);

    if (allOrders.length > 0) {
      console.log('\n📋 Very recent orders:');
      allOrders.forEach((order, index) => {
        console.log(`  ${index + 1}. Order #${order.id} - ${order.status} - ${order.date_created} - Total: ${order.total}`);
        console.log(`     Customer: ${order.customer?.first_name || order.billing?.first_name} ${order.customer?.last_name || order.billing?.last_name}`);
        console.log(`     Items: ${order.line_items?.length || 0}`);
        
        if (order.line_items && order.line_items.length > 0) {
          order.line_items.forEach((item, itemIndex) => {
            console.log(`       ${itemIndex + 1}. ${item.name} (SKU: ${item.sku || 'N/A'}) - Qty: ${item.quantity} - Price: ${item.price}`);
          });
        }
        console.log('');
      });
    }

    // Check for products with names similar to "claire" or "air cream"
    console.log('🔍 Searching for products with "claire" or "air" in name...');
    
    const wooProductsResponse = await axios.get(
      `${wooConnection.storeUrl}/wp-json/wc/v3/products?per_page=100`,
      { headers: wooHeaders }
    );

    const relevantProducts = wooProductsResponse.data.filter(product => 
      product.name.toLowerCase().includes('claire') || 
      product.name.toLowerCase().includes('air') ||
      product.name.toLowerCase().includes('cream')
    );

    if (relevantProducts.length > 0) {
      console.log(`📦 Found ${relevantProducts.length} relevant products:`);
      relevantProducts.forEach((product, index) => {
        console.log(`  ${index + 1}. ${product.name} (SKU: ${product.sku || 'N/A'}) - Price: ${product.price} - Stock: ${product.stock_quantity || 'N/A'}`);
      });
    } else {
      console.log('❌ No products found with "claire", "air", or "cream" in name');
    }

    // Check recent sales logs for any orders processed in the last hour
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
    const recentSalesLogs = await prisma.salesLog.findMany({
      where: {
        connectionId: wooConnection.id,
        createdAt: {
          gte: oneHourAgo
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`\n📊 Sales logs in last hour: ${recentSalesLogs.length}`);
    recentSalesLogs.forEach((log, index) => {
      console.log(`  ${index + 1}. Order ${log.orderId} - ${log.status} - ${log.createdAt}`);
    });

    // Check if the bidirectional sync is actually being called
    console.log('\n🔍 Testing bidirectional sync endpoint directly...');
    try {
      const syncResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      });

      console.log('✅ Sync endpoint test successful');
      console.log('Response:', JSON.stringify(syncResponse.data, null, 2));
    } catch (error) {
      console.error('❌ Sync endpoint test failed:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('❌ Check failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkVeryRecentOrders();
