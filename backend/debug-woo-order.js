const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function debugWooOrder() {
  try {
    console.log('🔍 DEBUGGING: WooCommerce order not syncing to Prokip');
    console.log('=' .repeat(60));
    
    // 1. Check WooCommerce connection
    console.log('\n🔗 1. WOOCOMMERCE CONNECTION:');
    console.log('-'.repeat(40));
    
    const wooConnection = await prisma.connection.findFirst({ where: { platform: 'woocommerce' } });
    
    if (!wooConnection) {
      console.log('❌ No WooCommerce connection found');
      return;
    }
    
    console.log(`✅ Found WooCommerce connection`);
    console.log(`🌐 Store URL: ${wooConnection.storeUrl}`);
    console.log(`🔑 Consumer Key: ${wooConnection.consumerKey ? 'Present' : 'Missing'}`);
    console.log(`🔐 Consumer Secret: ${wooConnection.consumerSecret ? 'Present' : 'Missing'}`);
    
    // 2. Test WooCommerce API access
    console.log('\n🛒 2. TESTING WOOCOMMERCE API:');
    console.log('-'.repeat(40));
    
    const wooHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${wooConnection.consumerKey}:${wooConnection.consumerSecret}`).toString('base64')}`
    };
    
    try {
      // Test basic API access
      const testResponse = await axios.get(`${wooConnection.storeUrl}/wp-json/wc/v3/system_status`, { headers: wooHeaders });
      console.log('✅ WooCommerce API access: OK');
    } catch (error) {
      console.log('❌ WooCommerce API access failed:', error.response?.status, error.response?.statusText);
      if (error.response?.data) {
        console.log('Error details:', error.response.data);
      }
      return;
    }
    
    // 3. Fetch recent orders
    console.log('\n📦 3. FETCHING RECENT ORDERS:');
    console.log('-'.repeat(40));
    
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const ordersUrl = `${wooConnection.storeUrl}/wp-json/wc/v3/orders?after=${yesterday}&status=completed&per_page=50`;
    
    console.log(`📡 Fetching from: ${ordersUrl}`);
    
    try {
      const ordersResponse = await axios.get(ordersUrl, { headers: wooHeaders });
      const orders = ordersResponse.data;
      
      console.log(`✅ Found ${orders.length} recent completed orders`);
      
      if (orders.length === 0) {
        console.log('ℹ️ No recent completed orders found');
        console.log('💡 Try creating a new order with status "completed"');
        return;
      }
      
      // Show order details
      for (const order of orders) {
        console.log(`\n📋 Order #${order.id}:`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Date: ${order.date_created}`);
        console.log(`   Total: ${order.total}`);
        console.log(`   Customer: ${order.billing.first_name} ${order.billing.last_name}`);
        console.log(`   Items: ${order.line_items.length}`);
        
        for (const item of order.line_items) {
          console.log(`     - ${item.name} (SKU: ${item.sku || 'No SKU'}) x${item.quantity} = ${item.total}`);
        }
      }
      
      // 4. Check if these orders were already processed
      console.log('\n📋 4. CHECKING IF ORDERS ALREADY PROCESSED:');
      console.log('-'.repeat(40));
      
      const processedOrders = [];
      for (const order of orders) {
        const logEntry = await prisma.salesLog.findFirst({
          where: { orderId: `WC-${order.id}` }
        });
        
        if (logEntry) {
          console.log(`❌ Order #${order.id} already processed on ${logEntry.orderDate.toLocaleString()}`);
          processedOrders.push(order.id);
        } else {
          console.log(`✅ Order #${order.id} NOT processed yet - should sync!`);
        }
      }
      
      // 5. Test creating sale for first unprocessed order
      const unprocessedOrder = orders.find(order => !processedOrders.includes(order.id));
      
      if (unprocessedOrder) {
        console.log('\n🧪 5. TESTING SYNC FOR UNPROCESSED ORDER:');
        console.log('-'.repeat(40));
        
        console.log(`🎯 Testing sync for Order #${unprocessedOrder.id}`);
        
        // Get Prokip config
        const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId: 50 } });
        
        if (!prokipConfig?.token) {
          console.log('❌ Prokip config not found');
          return;
        }
        
        // Get Prokip products
        const prokipHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${prokipConfig.token}`,
          Accept: 'application/json'
        };
        
        const productsResponse = await axios.get('https://api.prokip.africa/connector/api/product?per_page=-1', { headers: prokipHeaders });
        const prokipProducts = productsResponse.data.data;
        
        // Process first item from the order
        const firstItem = unprocessedOrder.line_items[0];
        const prokipProduct = prokipProducts.find(p => p.sku === firstItem.sku);
        
        if (!prokipProduct) {
          console.log(`❌ Product with SKU "${firstItem.sku}" not found in Prokip`);
          console.log('💡 Available SKUs:', prokipProducts.map(p => p.sku).filter(s => s).slice(0, 10));
          return;
        }
        
        console.log(`✅ Found Prokip product: ${prokipProduct.name} (ID: ${prokipProduct.id})`);
        
        // Get current stock
        const stockResponse = await axios.get(
          `https://api.prokip.africa/connector/api/product-stock-report?location_id=${prokipConfig.locationId}`,
          { headers: prokipHeaders }
        );
        
        const stockData = Array.isArray(stockResponse.data) ? stockResponse.data : (stockResponse.data.data || []);
        const currentStock = stockData.find(s => s.sku === firstItem.sku);
        const beforeStock = currentStock ? (currentStock.stock || currentStock.qty_available || 0) : 0;
        
        console.log(`📊 Current stock for ${firstItem.sku}: ${beforeStock}`);
        
        // Create sale
        const saleBody = {
          sells: [{
            location_id: parseInt(prokipConfig.locationId),
            contact_id: 1849984,
            transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
            invoice_no: `WC-${unprocessedOrder.id}`,
            status: 'final',
            type: 'sell',
            payment_status: 'paid',
            final_total: parseFloat(unprocessedOrder.total),
            products: [{
              name: firstItem.name,
              sku: firstItem.sku,
              quantity: parseInt(firstItem.quantity),
              unit_price: parseFloat(firstItem.price),
              total_price: parseFloat(firstItem.total),
              product_id: prokipProduct.id,
              variation_id: 5291257 // Using known variation ID
            }],
            payments: [{
              method: 'woocommerce',
              amount: parseFloat(unprocessedOrder.total),
              paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
            }]
          }]
        };
        
        console.log('📝 Creating sale in Prokip...');
        const saleResponse = await axios.post('https://api.prokip.africa/connector/api/sell', saleBody, { headers: prokipHeaders });
        
        if (saleResponse.data && Array.isArray(saleResponse.data) && saleResponse.data.length > 0) {
          console.log('✅ Sale created successfully!');
          console.log(`📊 Sale ID: ${saleResponse.data[0].id}`);
          
          // Check stock after
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const afterStockResponse = await axios.get(
            `https://api.prokip.africa/connector/api/product-stock-report?location_id=${prokipConfig.locationId}`,
            { headers: prokipHeaders }
          );
          
          const afterStockData = Array.isArray(afterStockResponse.data) ? afterStockResponse.data : (afterStockResponse.data.data || []);
          const afterStock = afterStockData.find(s => s.sku === firstItem.sku);
          const afterStockValue = afterStock ? (afterStock.stock || afterStock.qty_available || 0) : 0;
          
          console.log(`📊 Stock after sale: ${afterStockValue}`);
          console.log(`📈 Stock change: ${beforeStock} → ${afterStockValue} (${beforeStock - afterStockValue} deducted)`);
          
          // Log the sync
          await prisma.salesLog.create({
            data: {
              orderId: `WC-${unprocessedOrder.id}`,
              orderNumber: unprocessedOrder.number.toString(),
              customerName: `${unprocessedOrder.billing.first_name} ${unprocessedOrder.billing.last_name}`,
              customerEmail: unprocessedOrder.billing.email,
              totalAmount: parseFloat(unprocessedOrder.total),
              status: 'completed',
              orderDate: new Date(unprocessedOrder.date_created),
              syncedAt: new Date(),
              connectionId: wooConnection.id
            }
          });
          
          console.log('✅ Order logged to database');
          console.log('🎉 WooCommerce order successfully synced to Prokip!');
          
        } else {
          console.log('❌ Sale creation failed:', saleResponse.data);
        }
      }
      
    } catch (error) {
      console.log('❌ Failed to fetch orders:', error.message);
      if (error.response) {
        console.log('Response status:', error.response.status);
        console.log('Response data:', error.response.data);
      }
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('-'.repeat(40));
    console.log('1. Ensure WooCommerce orders have status "completed"');
    console.log('2. Ensure products have matching SKUs in both platforms');
    console.log('3. Check WooCommerce API credentials are correct');
    console.log('4. Verify Prokip contact ID 1849984 exists');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugWooOrder();
