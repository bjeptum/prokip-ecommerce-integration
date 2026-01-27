/**
 * Check for recent orders with specific products
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

async function checkSpecificProductOrders() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Checking for recent orders with Claire Wash and Hair cream...\n');

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

    // Check for orders in the last 6 hours
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    console.log(`📊 Fetching orders from last 6 hours since: ${sixHoursAgo}`);

    const [completedOrders, processingOrders] = await Promise.all([
      axios.get(
        `${wooConnection.storeUrl}/wp-json/wc/v3/orders?after=${sixHoursAgo}&per_page=50&status=completed`,
        { headers: wooHeaders }
      ),
      axios.get(
        `${wooConnection.storeUrl}/wp-json/wc/v3/orders?after=${sixHoursAgo}&per_page=50&status=processing`,
        { headers: wooHeaders }
      )
    ]);

    const allOrders = [...completedOrders.data, ...processingOrders.data];
    console.log(`📦 Found ${allOrders.length} orders in last 6 hours`);

    // Look for orders containing the specific products
    const targetSKUs = ['4848961', '4815445']; // Hair cream and Claire Wash
    const relevantOrders = [];

    allOrders.forEach(order => {
      if (order.line_items) {
        const hasTargetProduct = order.line_items.some(item => 
          targetSKUs.includes(item.sku)
        );
        if (hasTargetProduct) {
          relevantOrders.push(order);
        }
      }
    });

    if (relevantOrders.length > 0) {
      console.log(`\n📋 Found ${relevantOrders.length} orders with target products:`);
      relevantOrders.forEach((order, index) => {
        console.log(`  ${index + 1}. Order #${order.id} - ${order.status} - ${order.date_created} - Total: ${order.total}`);
        console.log(`     Customer: ${order.customer?.first_name || order.billing?.first_name} ${order.customer?.last_name || order.billing?.last_name}`);
        
        if (order.line_items && order.line_items.length > 0) {
          order.line_items.forEach((item, itemIndex) => {
            const isTarget = targetSKUs.includes(item.sku);
            console.log(`       ${itemIndex + 1}. ${item.name} (SKU: ${item.sku || 'N/A'}) - Qty: ${item.quantity} - Price: ${item.price} ${isTarget ? '⭐' : ''}`);
          });
        }
        console.log('');
      });
    } else {
      console.log('❌ No recent orders found with Hair cream or Claire Wash in the last 6 hours');
    }

    // Check if these orders have been processed in sales log
    console.log('📊 Checking sales log for orders with these products...');
    const recentSalesLogs = await prisma.salesLog.findMany({
      where: {
        connectionId: wooConnection.id,
        orderDate: {
          gte: new Date(Date.now() - 6 * 60 * 60 * 1000)
        }
      },
      orderBy: { orderDate: 'desc' }
    });

    console.log(`📦 Found ${recentSalesLogs.length} processed orders in last 6 hours:`);
    recentSalesLogs.forEach((log, index) => {
      console.log(`  ${index + 1}. Order ${log.orderId} - ${log.status} - ${log.orderDate} - Amount: ${log.totalAmount}`);
    });

    // Check current stock levels for these products
    console.log('\n📊 Checking current stock levels for target products...');
    const inventoryLogs = await prisma.inventoryLog.findMany({
      where: {
        connectionId: wooConnection.id,
        sku: { in: targetSKUs }
      }
    });

    console.log(`📦 Current stock levels:`);
    inventoryLogs.forEach((log, index) => {
      console.log(`  ${index + 1}. ${log.productName} (SKU: ${log.sku}) - Qty: ${log.quantity} - Last Synced: ${log.lastSynced}`);
    });

    // If no recent orders found, check the last 24 hours
    if (relevantOrders.length === 0) {
      console.log('\n🔍 Checking last 24 hours for these products...');
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const [completed24h, processing24h] = await Promise.all([
        axios.get(
          `${wooConnection.storeUrl}/wp-json/wc/v3/orders?after=${oneDayAgo}&per_page=100&status=completed`,
          { headers: wooHeaders }
        ),
        axios.get(
          `${wooConnection.storeUrl}/wp-json/wc/v3/orders?after=${oneDayAgo}&per_page=100&status=processing`,
          { headers: wooHeaders }
        )
      ]);

      const allOrders24h = [...completed24h.data, ...processing24h.data];
      const relevantOrders24h = [];

      allOrders24h.forEach(order => {
        if (order.line_items) {
          const hasTargetProduct = order.line_items.some(item => 
            targetSKUs.includes(item.sku)
          );
          if (hasTargetProduct) {
            relevantOrders24h.push(order);
          }
        }
      });

      if (relevantOrders24h.length > 0) {
        console.log(`📋 Found ${relevantOrders24h.length} orders with target products in last 24 hours:`);
        relevantOrders24h.forEach((order, index) => {
          console.log(`  ${index + 1}. Order #${order.id} - ${order.status} - ${order.date_created} - Total: ${order.total}`);
          
          if (order.line_items && order.line_items.length > 0) {
            order.line_items.forEach((item, itemIndex) => {
              const isTarget = targetSKUs.includes(item.sku);
              console.log(`       ${itemIndex + 1}. ${item.name} (SKU: ${item.sku || 'N/A'}) - Qty: ${item.quantity} - Price: ${item.price} ${isTarget ? '⭐' : ''}`);
            });
          }
          console.log('');
        });
      } else {
        console.log('❌ No orders found with Hair cream or Claire Wash in the last 24 hours either');
      }
    }

  } catch (error) {
    console.error('❌ Check failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSpecificProductOrders();
