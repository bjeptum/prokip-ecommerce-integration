const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function debugActualSync() {
  try {
    console.log('🔍 DEBUGGING: Actual sync process with your credentials');
    console.log('=' .repeat(60));
    
    // 1. Test your actual WooCommerce credentials
    console.log('\n🔗 1. TESTING YOUR WOOCOMMERCE CREDENTIALS:');
    console.log('-'.repeat(40));
    
    const wooConnection = await prisma.connection.findFirst({ where: { platform: 'woocommerce' } });
    
    if (!wooConnection) {
      console.log('❌ No WooCommerce connection found');
      return;
    }
    
    console.log(`🌐 Store URL: ${wooConnection.storeUrl}`);
    console.log(`🔑 Consumer Key: ${wooConnection.consumerKey ? 'Present' : 'Missing'}`);
    console.log(`🔐 Consumer Secret: ${wooConnection.consumerSecret ? 'Present' : 'Missing'}`);
    
    const wooHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${wooConnection.consumerKey}:${wooConnection.consumerSecret}`).toString('base64')}`
    };
    
    try {
      const testResponse = await axios.get(`${wooConnection.storeUrl}/wp-json/wc/v3/system_status`, { headers: wooHeaders });
      console.log('✅ WooCommerce API access: OK');
    } catch (error) {
      console.log('❌ WooCommerce API failed:', error.response?.status, error.response?.statusText);
      if (error.response?.data) {
        console.log('Error details:', error.response.data);
      }
      return;
    }
    
    // 2. Check for recent WooCommerce orders
    console.log('\n📦 2. CHECKING FOR RECENT WOOCOMMERCE ORDERS:');
    console.log('-'.repeat(40));
    
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const ordersUrl = `${wooConnection.storeUrl}/wp-json/wc/v3/orders?after=${yesterday}&status=completed&per_page=50`;
    
    try {
      const ordersResponse = await axios.get(ordersUrl, { headers: wooHeaders });
      const orders = ordersResponse.data;
      
      console.log(`✅ Found ${orders.length} recent completed orders`);
      
      if (orders.length === 0) {
        console.log('ℹ️ No recent completed orders found in last 24 hours');
        
        // Try last 7 days
        const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const weekOrdersUrl = `${wooConnection.storeUrl}/wp-json/wc/v3/orders?after=${lastWeek}&status=completed&per_page=50`;
        
        const weekResponse = await axios.get(weekOrdersUrl, { headers: wooHeaders });
        const weekOrders = weekResponse.data;
        
        console.log(`📊 Found ${weekOrders.length} orders in last 7 days`);
        
        if (weekOrders.length > 0) {
          console.log('💡 The sync only looks at last 24 hours - extending to 7 days might help');
          
          // Show some recent orders
          console.log('\n📋 Recent orders (last 7 days):');
          for (const order of weekOrders.slice(0, 3)) {
            console.log(`   Order #${order.id}: ${order.status} - ${order.total} (${order.date_created})`);
            console.log(`   Customer: ${order.billing.first_name} ${order.billing.last_name}`);
            console.log(`   Items: ${order.line_items.length}`);
            
            for (const item of order.line_items) {
              console.log(`     - ${item.name} (SKU: ${item.sku || 'No SKU'}) x${item.quantity} = ${item.total}`);
            }
            console.log('');
          }
        }
      } else {
        console.log('📋 Recent orders (last 24 hours):');
        for (const order of orders) {
          console.log(`   Order #${order.id}: ${order.status} - ${order.total} (${order.date_created})`);
          console.log(`   Customer: ${order.billing.first_name} ${order.billing.last_name}`);
          console.log(`   Items: ${order.line_items.length}`);
          
          for (const item of order.line_items) {
            console.log(`     - ${item.name} (SKU: ${item.sku || 'No SKU'}) x${item.quantity} = ${item.total}`);
          }
          console.log('');
        }
      }
      
    } catch (error) {
      console.log('❌ Failed to fetch orders:', error.message);
      if (error.response) {
        console.log('Response status:', error.response.status);
        console.log('Response data:', error.response.data);
      }
    }
    
    // 3. Check if these orders were already processed
    console.log('\n📋 3. CHECKING IF ORDERS ALREADY PROCESSED:');
    console.log('-'.repeat(40));
    
    const recentLogs = await prisma.salesLog.findMany({
      where: {
        orderDate: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { orderDate: 'desc' },
      take: 10
    });
    
    console.log(`Found ${recentLogs.length} sync operations in last 24 hours:`);
    
    for (const log of recentLogs) {
      const source = log.orderId.startsWith('WC-') ? 'WooCommerce → Prokip' : 'Prokip → WooCommerce';
      console.log(`- ${log.orderDate.toLocaleString()}: ${source} - Order ${log.orderId} (${log.totalAmount})`);
    }
    
    // 4. Check Prokip sales that should sync to WooCommerce
    console.log('\n🛒 4. CHECKING PROKIP SALES:');
    console.log('-'.repeat(40));
    
    const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId: 50 } });
    
    if (!prokipConfig?.token) {
      console.log('❌ Prokip config not found');
      return;
    }
    
    const prokipHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };
    
    try {
      const salesUrl = `https://api.prokip.africa/connector/api/sell?location_id=${prokipConfig.locationId}&per_page=50`;
      const salesResponse = await axios.get(salesUrl, { headers: prokipHeaders });
      const sales = salesResponse.data.data || salesResponse.data || [];
      
      console.log(`✅ Found ${sales.length} recent Prokip sales`);
      
      // Filter out WooCommerce-originated sales
      const nonWooSales = sales.filter(sale => 
        !sale.invoice_no || !sale.invoice_no.startsWith('WC-')
      );
      
      console.log(`📊 Non-WooCommerce sales: ${nonWooSales.length}`);
      
      if (nonWooSales.length > 0) {
        console.log('📋 Prokip sales that should sync to WooCommerce:');
        for (const sale of nonWooSales.slice(0, 3)) {
          console.log(`   Sale #${sale.id}: ${sale.invoice_no} - ${sale.final_total} (${sale.transaction_date})`);
          
          if (sale.products && sale.products.length > 0) {
            for (const product of sale.products) {
              console.log(`     - ${product.name} (SKU: ${product.sku}) x${product.quantity} = ${product.total_price}`);
            }
          }
          console.log('');
        }
      } else {
        console.log('ℹ️ No recent Prokip sales to sync to WooCommerce');
      }
      
    } catch (error) {
      console.log('❌ Failed to fetch Prokip sales:', error.message);
    }
    
    // 5. Test the actual sync endpoint
    console.log('\n🔄 5. TESTING ACTUAL SYNC ENDPOINT:');
    console.log('-'.repeat(40));
    
    try {
      const syncResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('✅ Sync endpoint responded:', syncResponse.status);
      console.log('📊 Response:', JSON.stringify(syncResponse.data, null, 2));
      
      if (syncResponse.data.success) {
        const { results } = syncResponse.data;
        
        console.log('\n📈 SYNC RESULTS:');
        console.log('-'.repeat(40));
        
        if (results.wooToProkip) {
          console.log(`WooCommerce → Prokip:`);
          console.log(`  Processed: ${results.wooToProkip.processed}`);
          console.log(`  Success: ${results.wooToProkip.success}`);
          console.log(`  Stock Deducted: ${results.wooToProkip.stockDeducted || 0}`);
          console.log(`  Errors: ${results.wooToProkip.errors.length}`);
          
          if (results.wooToProkip.errors.length > 0) {
            console.log('  Error details:');
            results.wooToProkip.errors.forEach((error, i) => {
              console.log(`    ${i + 1}. ${error}`);
            });
          }
        }
        
        if (results.prokipToWoo) {
          console.log(`Prokip → WooCommerce:`);
          console.log(`  Processed: ${results.prokipToWoo.processed}`);
          console.log(`  Success: ${results.prokipToWoo.success}`);
          console.log(`  Stock Updated: ${results.prokipToWoo.stockUpdated || 0}`);
          console.log(`  Errors: ${results.prokipToWoo.errors.length}`);
          
          if (results.prokipToWoo.errors.length > 0) {
            console.log('  Error details:');
            results.prokipToWoo.errors.forEach((error, i) => {
              console.log(`    ${i + 1}. ${error}`);
            });
          }
        }
      }
      
    } catch (error) {
      console.log('❌ Sync endpoint failed:', error.message);
      if (error.response) {
        console.log('Response status:', error.response.status);
        console.log('Response data:', error.response.data);
      }
    }
    
    // 6. Diagnosis
    console.log('\n🎯 6. DIAGNOSIS:');
    console.log('-'.repeat(40));
    
    console.log('Based on the above analysis:');
    console.log('1. WooCommerce API credentials: Working ✅' || 'Not Working ❌');
    console.log('2. Recent WooCommerce orders: Found or Not Found');
    console.log('3. Recent Prokip sales: Found or Not Found');
    console.log('4. Sync endpoint: Working or Not Working');
    console.log('5. Stock deduction: Working or Not Working');
    
    console.log('\n💡 POSSIBLE ISSUES:');
    console.log('1. No recent orders/sales in the 24-hour window');
    console.log('2. Product SKU mismatches between platforms');
    console.log('3. Orders not marked as "completed" in WooCommerce');
    console.log('4. Sync time range too narrow');
    console.log('5. Database logging issues');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugActualSync();
