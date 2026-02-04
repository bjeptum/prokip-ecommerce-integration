const axios = require('axios');

async function debugWooCommerceOrders() {
  try {
    console.log('🧪 Debugging WooCommerce orders detection...');
    
    // Login to get token
    const loginResponse = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'Myifrit37942949#'
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.token;
      console.log('✅ Login successful, token present');
      
      // Check recent WooCommerce orders directly
      console.log('\n🧪 Checking recent WooCommerce orders...');
      try {
        // Get WooCommerce connection
        const prisma = require('./src/lib/prisma');
        const connection = await prisma.connection.findFirst({ where: { platform: 'woocommerce' } });
        
        if (!connection) {
          console.log('❌ No WooCommerce connection found');
          return;
        }
        
        // Decrypt credentials
        const { decryptCredentials } = require('./src/services/storeService');
        const { consumerKey, consumerSecret } = decryptCredentials(connection);
        
        const wooHeaders = {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`
        };
        
        // Get recent orders (last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        console.log(`🔍 Looking for orders since: ${oneDayAgo}`);
        
        const [completedOrders, processingOrders] = await Promise.all([
          axios.get(
            `${connection.storeUrl}/wp-json/wc/v3/orders?after=${oneDayAgo}&per_page=50&status=completed`,
            { headers: wooHeaders }
          ),
          axios.get(
            `${connection.storeUrl}/wp-json/wc/v3/orders?after=${oneDayAgo}&per_page=50&status=processing`,
            { headers: wooHeaders }
          )
        ]);
        
        const allOrders = [...completedOrders.data, ...processingOrders.data];
        console.log(`📊 Found ${completedOrders.data.length} completed and ${processingOrders.data.length} processing orders (last 24h)`);
        console.log(`📊 Total recent orders: ${allOrders.length}`);
        
        if (allOrders.length > 0) {
          console.log('\n📦 Recent orders:');
          allOrders.forEach((order, index) => {
            console.log(`${index + 1}. Order #${order.id} - ${order.status} - ${order.date_created} - Total: ${order.total}`);
            
            if (order.line_items && order.line_items.length > 0) {
              order.line_items.forEach((item, itemIndex) => {
                console.log(`   Item ${itemIndex + 1}: ${item.name} (SKU: ${item.sku}) - Qty: ${item.quantity} - Price: ${item.price}`);
              });
            }
          });
        } else {
          console.log('❌ No recent orders found in last 24 hours');
        }
        
      } catch (ordersError) {
        console.error('❌ Failed to fetch WooCommerce orders:', ordersError.response?.data || ordersError.message);
      }
      
    } else {
      console.log('❌ Login failed');
    }
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugWooCommerceOrders();
