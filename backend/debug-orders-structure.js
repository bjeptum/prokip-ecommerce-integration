const axios = require('axios');

async function debugOrdersStructure() {
  try {
    console.log('🔍 DEBUGGING: Orders Structure and Recent Order');
    
    // Login to get token
    const loginResponse = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'Myifrit37942949#'
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.token;
      console.log('✅ Login successful, token present');
      
      // Step 1: Check orders response structure
      console.log('\n🧪 Step 1: Checking orders response structure...');
      try {
        const ordersResponse = await axios.get('http://localhost:3000/stores/my-store/orders?connectionId=1', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('📊 Orders response type:', typeof ordersResponse.data);
        console.log('📊 Orders response keys:', Object.keys(ordersResponse.data));
        
        if (ordersResponse.data.products) {
          console.log('📊 Found products array with length:', ordersResponse.data.products.length);
          const orders = ordersResponse.data.products;
          
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
          
          // Step 2: Focus on the most recent order that might not have stock deducted
          console.log('\n🧪 Step 2: Checking most recent unprocessed order...');
          const prisma = require('./src/lib/prisma');
          
          // Find the most recent order that was processed but stock not deducted
          const recentUnprocessedLog = await prisma.salesLog.findFirst({
            where: { 
              connectionId: 1,
              stockDeducted: false 
            },
            orderBy: { orderDate: 'desc' }
          });
          
          if (recentUnprocessedLog) {
            console.log(`📊 Found recent order without stock deduction: Order #${recentUnprocessedLog.orderId}`);
            
            // Find this order in the recent orders
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
              
              console.log(`\n🎯 This order should have stock deducted from Prokip!`);
              
              // Step 3: Clear the sales log and re-process this specific order
              console.log(`\n🧪 Step 3: Clearing sales log for Order #${recentUnprocessedLog.orderId} to re-process...`);
              
              await prisma.salesLog.delete({
                where: { id: recentUnprocessedLog.id }
              });
              
              console.log(`✅ Sales log cleared - Order #${recentUnprocessedLog.orderId} will be processed again`);
              
              // Step 4: Run bidirectional sync to process this order
              console.log(`\n🧪 Step 4: Running bidirectional sync to process Order #${recentUnprocessedLog.orderId}...`);
              
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
              console.log(`❌ Could not find order #${recentUnprocessedLog.orderId} in recent orders`);
            }
          } else {
            console.log(`✅ No recent orders found without stock deduction`);
          }
          
        } else {
          console.log('❌ No products array found in orders response');
        }
        
      } catch (ordersError) {
        console.error('❌ Failed to fetch WooCommerce orders:', ordersError.response?.data || ordersError.message);
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

debugOrdersStructure();
