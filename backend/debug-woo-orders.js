/**
 * Debug WooCommerce order fetching
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

async function debugWooCommerceOrders() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Debugging WooCommerce order fetching...\n');

    // Get WooCommerce connection
    const wooConnection = await prisma.connection.findFirst({ 
      where: { platform: 'woocommerce' } 
    });

    if (!wooConnection) {
      console.error('❌ No WooCommerce connection found');
      return;
    }

    console.log('✅ Found WooCommerce connection:', {
      id: wooConnection.id,
      storeUrl: wooConnection.storeUrl,
      hasConsumerKey: !!wooConnection.consumerKey,
      hasConsumerSecret: !!wooConnection.consumerSecret
    });

    // Decrypt credentials
    const { decryptCredentials } = require('./src/services/storeService');
    const { consumerKey, consumerSecret } = decryptCredentials(wooConnection);
    
    console.log('🔑 Credentials decrypted successfully');

    const wooHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`
    };

    // Test 1: Get recent orders with different time ranges
    console.log('\n📅 Test 1: Orders from last 7 days');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    try {
      const ordersResponse = await axios.get(
        `${wooConnection.storeUrl}/wp-json/wc/v3/orders?after=${sevenDaysAgo}&per_page=50&status=completed`,
        { headers: wooHeaders }
      );
      console.log(`✅ Found ${ordersResponse.data.length} completed orders in last 7 days`);
      
      if (ordersResponse.data.length > 0) {
        console.log('Recent orders:');
        ordersResponse.data.slice(0, 3).forEach(order => {
          console.log(`- Order #${order.id}: ${order.order_number} - ${order.total} - ${order.created_at}`);
          console.log(`  Items: ${order.line_items?.length || 0}`);
          order.line_items?.forEach(item => {
            console.log(`    * ${item.name} (SKU: ${item.sku}) - Qty: ${item.quantity}`);
          });
        });
      }
    } catch (error) {
      console.error('❌ Failed to fetch orders:', error.response?.status, error.response?.statusText);
      console.error('Error details:', error.response?.data);
    }

    // Test 2: Get all orders (no date filter)
    console.log('\n📅 Test 2: All recent orders (no date filter)');
    try {
      const allOrdersResponse = await axios.get(
        `${wooConnection.storeUrl}/wp-json/wc/v3/orders?per_page=10&status=completed`,
        { headers: wooHeaders }
      );
      console.log(`✅ Found ${allOrdersResponse.data.length} recent completed orders`);
      
      if (allOrdersResponse.data.length > 0) {
        console.log('Most recent orders:');
        allOrdersResponse.data.forEach(order => {
          console.log(`- Order #${order.id}: ${order.order_number} - ${order.total} - ${order.status} - ${order.created_at}`);
        });
      }
    } catch (error) {
      console.error('❌ Failed to fetch all orders:', error.response?.status, error.response?.statusText);
    }

    // Test 3: Check different order statuses
    console.log('\n📅 Test 3: Orders with processing status');
    try {
      const processingOrdersResponse = await axios.get(
        `${wooConnection.storeUrl}/wp-json/wc/v3/orders?per_page=10&status=processing`,
        { headers: wooHeaders }
      );
      console.log(`✅ Found ${processingOrdersResponse.data.length} processing orders`);
    } catch (error) {
      console.error('❌ Failed to fetch processing orders:', error.response?.status, error.response?.statusText);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugWooCommerceOrders();
