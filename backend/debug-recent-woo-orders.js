const axios = require('axios');

async function debugRecentWooCommerceOrders() {
  try {
    console.log('🔍 DEBUGGING: Recent WooCommerce Orders');
    
    // Login to get token
    const loginResponse = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'Myifrit37942949#'
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.token;
      console.log('✅ Login successful, token present');
      
      // Step 1: Check recent WooCommerce orders
      console.log('\n🧪 Step 1: Checking recent WooCommerce orders...');
      try {
        const ordersResponse = await axios.get('http://localhost:3000/stores/my-store/orders?connectionId=1', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        const orders = ordersResponse.data;
        console.log(`📊 Found ${orders.length} total orders`);
        
        // Show recent orders (last 5)
        const recentOrders = orders.slice(0, 5);
        console.log('\n📋 Recent Orders:');
        recentOrders.forEach((order, index) => {
          console.log(`  ${index + 1}. Order #${order.id || order.order_number} - Status: ${order.status} - Date: ${order.date_created || order.created_at} - Total: ${order.total}`);
          
          if (order.line_items) {
            order.line_items.forEach((item, itemIndex) => {
              console.log(`     - Item: ${item.name} (SKU: ${item.sku}) - Qty: ${item.quantity} - Price: ${item.price}`);
            });
          }
        });
        
      } catch (ordersError) {
        console.error('❌ Failed to fetch WooCommerce orders:', ordersError.response?.data || ordersError.message);
      }
      
      // Step 2: Check sales logs to see which orders have been processed
      console.log('\n🧪 Step 2: Checking processed sales logs...');
      const prisma = require('./src/lib/prisma');
      
      const salesLogs = await prisma.salesLog.findMany({
        where: { connectionId: 1 },
        orderBy: { orderDate: 'desc' },
        take: 10
      });
      
      console.log(`📊 Found ${salesLogs.length} processed orders in sales logs:`);
      salesLogs.forEach((log, index) => {
        console.log(`  ${index + 1}. Order #${log.orderId} - Processed: ${log.syncedAt} - Stock Deducted: ${log.stockDeducted}`);
      });
      
      // Step 3: Identify unprocessed recent orders
      console.log('\n🧪 Step 3: Identifying unprocessed recent orders...');
      try {
        const ordersResponse = await axios.get('http://localhost:3000/stores/my-store/orders?connectionId=1', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        const recentOrders = ordersResponse.data.slice(0, 10); // Last 10 orders
        const processedOrderIds = salesLogs.map(log => log.orderId);
        
        const unprocessedOrders = recentOrders.filter(order => 
          !processedOrderIds.includes(order.id?.toString()) && 
          (order.status === 'completed' || order.status === 'processing')
        );
        
        console.log(`📊 Found ${unprocessedOrders.length} unprocessed orders:`);
        unprocessedOrders.forEach((order, index) => {
          console.log(`  ${index + 1}. Order #${order.id} - Status: ${order.status} - Date: ${order.date_created} - Total: ${order.total}`);
          if (order.line_items) {
            order.line_items.forEach(item => {
              console.log(`     - Item: ${item.name} (SKU: ${item.sku}) - Qty: ${item.quantity}`);
            });
          }
        });
        
        if (unprocessedOrders.length > 0) {
          console.log('\n✅ Found unprocessed orders! These should be processed by bidirectional sync.');
        } else {
          console.log('\n⚠️ No unprocessed orders found. All recent orders have been processed.');
        }
        
      } catch (error) {
        console.error('❌ Error checking unprocessed orders:', error.message);
      }
      
    } else {
      console.log('❌ Login failed');
    }
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugRecentWooCommerceOrders();
