const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function verifyStockDeduction() {
  try {
    console.log('🔍 Verifying stock deduction for recent sales...');
    
    // Get the recent sales log entry
    const salesLog = await prisma.salesLog.findFirst({
      where: {
        connectionId: 5,
        orderId: '14148'
      }
    });
    
    if (!salesLog) {
      console.log('❌ No sales log entry found for order #14148');
      return;
    }
    
    console.log('✅ Sales log entry found:');
    console.log(`- Order: #${salesLog.orderId}`);
    console.log(`- Amount: ${salesLog.totalAmount}`);
    console.log(`- Status: ${salesLog.status}`);
    console.log(`- Date: ${salesLog.orderDate}`);
    
    // Get the WooCommerce order details to see what products were sold
    const { getWooOrders } = require('./src/services/wooService');
    const { decryptCredentials } = require('./src/services/storeService');
    
    const connection = await prisma.connection.findFirst({
      where: { id: 5 }
    });
    
    const { consumerKey, consumerSecret } = decryptCredentials(connection);
    const orders = await getWooOrders(connection.storeUrl, consumerKey, consumerSecret, null, null, null, null, null);
    
    const order = orders.find(o => o.id.toString() === '14148');
    if (!order) {
      console.log('❌ Order #14148 not found in WooCommerce');
      return;
    }
    
    console.log('\n📦 Order #14148 products:');
    order.line_items.forEach((item, index) => {
      console.log(`${index + 1}. SKU: ${item.sku || 'NO SKU'} - Qty: ${item.quantity} - Price: ${item.price}`);
    });
    
    // Check current Prokip inventory for these products
    console.log('\n🔍 Checking current Prokip inventory...');
    
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });
    
    if (!prokipConfig?.token) {
      console.log('❌ No Prokip config found');
      return;
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };
    
    try {
      const response = await axios.get('https://api.prokip.africa/connector/api/product-stock-report', { headers });
      const inventory = response.data;
      
      console.log('\n📊 Current Prokip stock levels:');
      order.line_items.forEach((item, index) => {
        if (item.sku) {
          const product = Array.isArray(inventory) ? inventory.find(p => p.sku === item.sku) : null;
          if (product) {
            console.log(`${index + 1}. SKU ${item.sku}: ${product.stock_quantity} units available`);
          } else {
            console.log(`${index + 1}. SKU ${item.sku}: NOT FOUND in Prokip inventory`);
          }
        } else {
          console.log(`${index + 1}. NO SKU: Cannot check stock`);
        }
      });
      
      // Debug: Show what we received from Prokip
      console.log('\n🔍 Debug - Prokip API response:');
      console.log('Type:', typeof inventory);
      console.log('Is Array:', Array.isArray(inventory));
      console.log('Keys:', Object.keys(inventory || {}));
      if (Array.isArray(inventory)) {
        console.log('Sample items:', inventory.slice(0, 2));
      }
      
      // Check if there are any recent sales in Prokip
      console.log('\n🔍 Checking recent Prokip sales...');
      try {
        const salesResponse = await axios.get('https://api.prokip.africa/connector/api/sales?per_page=10', { headers });
        const recentSales = salesResponse.data;
        
        console.log(`Found ${recentSales.length} recent sales in Prokip:`);
        recentSales.forEach((sale, index) => {
          console.log(`${index + 1}. Sale ID: ${sale.id} - Amount: ${sale.total_amount} - Date: ${sale.created_at}`);
          if (sale.reference_number === '14148') {
            console.log(`   ✅ This matches our WooCommerce order!`);
          }
        });
      } catch (error) {
        console.log('❌ Could not fetch Prokip sales:', error.message);
      }
      
    } catch (error) {
      console.log('❌ Could not fetch Prokip inventory:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyStockDeduction();
