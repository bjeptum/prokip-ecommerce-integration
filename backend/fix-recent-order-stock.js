const axios = require('axios');

async function fixRecentOrderStockDeduction() {
  try {
    console.log('🔧 FIXING: Recent Order Stock Deduction');
    
    // Login to get token
    const loginResponse = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'Myifrit37942949#'
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.token;
      console.log('✅ Login successful, token present');
      
      const prisma = require('./src/lib/prisma');
      
      // Step 1: Find the most recent order that was processed but stock not deducted
      console.log('\n🧪 Step 1: Finding recent order without stock deduction...');
      
      const recentUnprocessedLog = await prisma.salesLog.findFirst({
        where: { 
          connectionId: 1,
          stockDeducted: false 
        },
        orderBy: { orderDate: 'desc' }
      });
      
      if (recentUnprocessedLog) {
        console.log(`📊 Found recent order without stock deduction: Order #${recentUnprocessedLog.orderId}`);
        console.log(`   - Processed at: ${recentUnprocessedLog.syncedAt}`);
        console.log(`   - Total: ${recentUnprocessedLog.totalAmount}`);
        
        // Step 2: Get the order details from WooCommerce
        console.log(`\n🧪 Step 2: Getting order details from WooCommerce...`);
        
        try {
          const ordersResponse = await axios.get('http://localhost:3000/stores/my-store/orders?connectionId=1', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          const orders = ordersResponse.data.orders;
          const targetOrder = orders.find(order => 
            (order.id?.toString() === recentUnprocessedLog.orderId) || 
            (order.order_number?.toString() === recentUnprocessedLog.orderId)
          );
          
          if (targetOrder) {
            console.log(`✅ Found order details:`);
            console.log(`  - Order #${targetOrder.id}`);
            console.log(`  - Status: ${targetOrder.status}`);
            console.log(`  - Date: ${targetOrder.date_created}`);
            console.log(`  - Total: ${targetOrder.total}`);
            
            if (targetOrder.line_items) {
              console.log(`  - Items:`);
              targetOrder.line_items.forEach((item, index) => {
                console.log(`    ${index + 1}. ${item.name} (SKU: ${item.sku}) - Qty: ${item.quantity} - Price: ${item.price}`);
              });
            }
            
            // Step 3: Clear the sales log and re-process this order
            console.log(`\n🧪 Step 3: Clearing sales log to re-process Order #${recentUnprocessedLog.orderId}...`);
            
            await prisma.salesLog.delete({
              where: { id: recentUnprocessedLog.id }
            });
            
            console.log(`✅ Sales log cleared - Order #${recentUnprocessedLog.orderId} will be processed again`);
            
            // Step 4: Run bidirectional sync to process this order with stock deduction
            console.log(`\n🧪 Step 4: Running bidirectional sync to deduct stock from Prokip...`);
            
            try {
              const syncResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              
              console.log('✅ Bidirectional sync completed!');
              console.log('📊 Results:', JSON.stringify(syncResponse.data, null, 2));
              
              const { results } = syncResponse.data;
              if (results.wooToProkip && results.wooToProkip.stockDeducted > 0) {
                console.log(`\n🎉 SUCCESS! Stock deducted from Prokip: ${results.wooToProkip.stockDeducted} items`);
                console.log(`✅ Your recent WooCommerce sale has been processed and stock deducted from Prokip!`);
              } else {
                console.log(`\n⚠️ No stock was deducted. Check the errors above.`);
              }
              
            } catch (syncError) {
              console.error('❌ Bidirectional sync failed:', syncError.response?.data || syncError.message);
            }
            
          } else {
            console.log(`❌ Could not find order #${recentUnprocessedLog.orderId} in recent orders`);
          }
          
        } catch (ordersError) {
          console.error('❌ Failed to fetch WooCommerce orders:', ordersError.response?.data || ordersError.message);
        }
        
      } else {
        console.log(`✅ No recent orders found without stock deduction`);
        
        // Check if there are any very recent orders that might not be in sales logs yet
        console.log(`\n🧪 Checking for very recent orders...`);
        
        try {
          const ordersResponse = await axios.get('http://localhost:3000/stores/my-store/orders?connectionId=1', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          const orders = ordersResponse.data.orders;
          const recentOrders = orders.slice(0, 3); // Last 3 orders
          
          console.log(`📊 Last 3 orders:`);
          recentOrders.forEach((order, index) => {
            console.log(`  ${index + 1}. Order #${order.id} - Status: ${order.status} - Date: ${order.date_created} - Total: ${order.total}`);
          });
          
          // Find orders in the last hour that might not be processed yet
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          const veryRecentOrders = recentOrders.filter(order => {
            const orderDate = new Date(order.date_created);
            return orderDate > oneHourAgo && (order.status === 'completed' || order.status === 'processing');
          });
          
          if (veryRecentOrders.length > 0) {
            console.log(`\n🎯 Found ${veryRecentOrders.length} very recent orders that should be processed:`);
            veryRecentOrders.forEach(order => {
              console.log(`  - Order #${order.id} - Status: ${order.status} - Date: ${order.date_created}`);
            });
            
            console.log(`\n🔧 Running bidirectional sync to process these recent orders...`);
            
            try {
              const syncResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              
              console.log('✅ Bidirectional sync completed!');
              console.log('📊 Results:', JSON.stringify(syncResponse.data, null, 2));
              
            } catch (syncError) {
              console.error('❌ Bidirectional sync failed:', syncError.response?.data || syncError.message);
            }
          } else {
            console.log(`\n✅ No very recent orders found to process`);
          }
          
        } catch (error) {
          console.error('❌ Error checking recent orders:', error.message);
        }
      }
      
    } else {
      console.log('❌ Login failed');
    }
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixRecentOrderStockDeduction();
