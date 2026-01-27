/**
 * Check for recent WooCommerce orders and debug sync issues
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

async function checkRecentWooOrders() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Checking recent WooCommerce orders...\n');

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

    // Get orders from last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    console.log(`📊 Fetching orders since: ${oneDayAgo}`);

    const [completedOrders, processingOrders] = await Promise.all([
      axios.get(
        `${wooConnection.storeUrl}/wp-json/wc/v3/orders?after=${oneDayAgo}&per_page=10&status=completed`,
        { headers: wooHeaders }
      ),
      axios.get(
        `${wooConnection.storeUrl}/wp-json/wc/v3/orders?after=${oneDayAgo}&per_page=10&status=processing`,
        { headers: wooHeaders }
      )
    ]);

    const allOrders = [...completedOrders.data, ...processingOrders.data];
    console.log(`📦 Found ${allOrders.length} recent orders`);

    if (allOrders.length === 0) {
      console.log('⚠️ No recent orders found in the last 24 hours');
      
      // Try last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      console.log(`\n📊 Trying orders from last 7 days since: ${sevenDaysAgo}`);
      
      const [completed7Days, processing7Days] = await Promise.all([
        axios.get(
          `${wooConnection.storeUrl}/wp-json/wc/v3/orders?after=${sevenDaysAgo}&per_page=20&status=completed`,
          { headers: wooHeaders }
        ),
        axios.get(
          `${wooConnection.storeUrl}/wp-json/wc/v3/orders?after=${sevenDaysAgo}&per_page=20&status=processing`,
          { headers: wooHeaders }
        )
      ]);

      const allOrders7Days = [...completed7Days.data, ...processing7Days.data];
      console.log(`📦 Found ${allOrders7Days.length} orders in last 7 days`);

      if (allOrders7Days.length > 0) {
        console.log('\n📋 Recent orders (last 7 days):');
        allOrders7Days.slice(0, 5).forEach((order, index) => {
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
    } else {
      console.log('\n📋 Recent orders (last 24 hours):');
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

    // Check sales log for processed orders
    console.log('📊 Checking sales log for processed orders...');
    const recentSalesLogs = await prisma.salesLog.findMany({
      where: {
        connectionId: wooConnection.id,
        orderDate: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { orderDate: 'desc' },
      take: 10
    });

    console.log(`📦 Found ${recentSalesLogs.length} processed orders in sales log:`);
    recentSalesLogs.forEach((log, index) => {
      console.log(`  ${index + 1}. Order ${log.orderId} - ${log.status} - ${log.orderDate} - Amount: ${log.totalAmount}`);
    });

    // Check inventory logs
    console.log('\n📊 Checking inventory logs...');
    const inventoryLogs = await prisma.inventoryLog.findMany({
      where: { connectionId: wooConnection.id },
      orderBy: { lastSynced: 'desc' },
      take: 5
    });

    console.log(`📦 Recent inventory updates:`);
    inventoryLogs.forEach((log, index) => {
      console.log(`  ${index + 1}. ${log.productName} (SKU: ${log.sku}) - Qty: ${log.quantity} - Last Synced: ${log.lastSynced}`);
    });

  } catch (error) {
    console.error('❌ Check failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecentWooOrders();
