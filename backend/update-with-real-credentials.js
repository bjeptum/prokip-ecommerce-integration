const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function updateWithRealCredentials() {
  try {
    console.log('🔧 UPDATING: WooCommerce credentials with your working ones');
    console.log('=' .repeat(60));
    
    // Your provided credentials
    const workingCredentials = {
      consumerKey: 'ck_9dd6b146b7abfd64660215805e0913446cd41597338',
      consumerSecret: 'cs_d8e1b8c2cd2c5e5aee3f943971f9e379449baa1e'
    };
    
    console.log('🔑 Consumer Key:', workingCredentials.consumerKey.substring(0, 20) + '...');
    console.log('🔐 Consumer Secret:', workingCredentials.consumerSecret.substring(0, 20) + '...');
    
    // Get WooCommerce connection
    const wooConnection = await prisma.connection.findFirst({ 
      where: { platform: 'woocommerce' } 
    });
    
    if (!wooConnection) {
      console.log('❌ No WooCommerce connection found');
      return;
    }
    
    console.log(`🌐 Store URL: ${wooConnection.storeUrl}`);
    console.log(`📝 Connection ID: ${wooConnection.id}`);
    
    // Update with working credentials
    console.log('\n🔄 UPDATING DATABASE...');
    console.log('-'.repeat(40));
    
    await prisma.connection.update({
      where: { id: wooConnection.id },
      data: {
        consumerKey: workingCredentials.consumerKey,
        consumerSecret: workingCredentials.consumerSecret
      }
    });
    
    console.log('✅ Database updated with working credentials!');
    
    // Test the new credentials
    console.log('\n🧪 TESTING NEW CREDENTIALS...');
    console.log('-'.repeat(40));
    
    const testHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${workingCredentials.consumerKey}:${workingCredentials.consumerSecret}`).toString('base64')}`
    };
    
    try {
      const testResponse = await axios.get(`${wooConnection.storeUrl}/wp-json/wc/v3/system_status`, { headers: testHeaders });
      console.log('✅ WooCommerce API access: SUCCESS!');
      
      // Test fetching orders
      console.log('\n📦 TESTING ORDERS FETCH...');
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const ordersUrl = `${wooConnection.storeUrl}/wp-json/wc/v3/orders?after=${yesterday}&status=completed&per_page=10`;
      
      const ordersResponse = await axios.get(ordersUrl, { headers: testHeaders });
      const orders = ordersResponse.data;
      
      console.log(`✅ Found ${orders.length} recent completed orders`);
      
      if (orders.length > 0) {
        console.log('\n📋 Recent orders:');
        for (const order of orders.slice(0, 3)) {
          console.log(`   Order #${order.id}: ${order.status} - ${order.total} (${order.date_created})`);
          console.log(`   Customer: ${order.billing.first_name} ${order.billing.last_name}`);
          console.log(`   Items: ${order.line_items.length}`);
          
          for (const item of order.line_items) {
            console.log(`     - ${item.name} (SKU: ${item.sku || 'No SKU'}) x${item.quantity} = ${item.total}`);
          }
          console.log('');
        }
      }
      
      // Test fetching products to check stock
      console.log('\n🛒 TESTING PRODUCTS FETCH...');
      const productsUrl = `${wooConnection.storeUrl}/wp-json/wc/v3/products?per_page=10`;
      
      const productsResponse = await axios.get(productsUrl, { headers: testHeaders });
      const products = productsResponse.data;
      
      console.log(`✅ Found ${products.length} products`);
      
      // Look for air cream/hair cream
      const airCream = products.find(p => 
        p.name && (p.name.toLowerCase().includes('air cream') || p.name.toLowerCase().includes('hair cream')) ||
        p.sku && (p.sku.toLowerCase().includes('air') || p.sku.toLowerCase().includes('cream'))
      );
      
      if (airCream) {
        console.log('\n✅ FOUND AIR/HAIR CREAM:');
        console.log(`   Name: ${airCream.name}`);
        console.log(`   SKU: ${airCream.sku || 'No SKU'}`);
        console.log(`   Stock: ${airCream.stock_quantity || 0}`);
        console.log(`   Price: ${airCream.price || 'Not specified'}`);
        
        // Now test bidirectional sync
        console.log('\n🔄 TESTING BIDIRECTIONAL SYNC...');
        console.log('-'.repeat(40));
        
        const syncResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
          headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('✅ Sync response status:', syncResponse.status);
        console.log('📊 Sync results:', JSON.stringify(syncResponse.data, null, 2));
        
        if (syncResponse.data.success) {
          const { results } = syncResponse.data;
          
          console.log('\n📈 SYNC ANALYSIS:');
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
          
          console.log('\n🎯 FINAL VERIFICATION:');
          console.log('-'.repeat(40));
          
          // Check Prokip stock after sync
          const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId: 50 } });
          
          if (prokipConfig?.token) {
            const prokipHeaders = {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${prokipConfig.token}`,
              Accept: 'application/json'
            };
            
            try {
              const stockResponse = await axios.get(
                `https://api.prokip.africa/connector/api/product-stock-report?location_id=${prokipConfig.locationId}`,
                { headers: prokipHeaders }
              );
              
              const stockData = Array.isArray(stockResponse.data) ? stockResponse.data : (stockResponse.data.data || []);
              const prokipStock = stockData.find(s => s.sku === airCream.sku);
              
              if (prokipStock) {
                console.log(`Prokip stock after sync: ${prokipStock.stock || prokipStock.qty_available || 0}`);
                console.log(`WooCommerce stock: ${airCream.stock_quantity || 0}`);
                
                const difference = Math.abs((prokipStock.stock || prokipStock.qty_available || 0) - (airCream.stock_quantity || 0));
                
                if (difference <= 1) {
                  console.log('✅ STOCK LEVELS ARE NOW SYNCHRONIZED!');
                } else {
                  console.log(`❌ Stock levels still differ by: ${difference}`);
                }
              }
              
            } catch (stockError) {
              console.log('❌ Failed to check Prokip stock:', stockError.message);
            }
          }
          
          console.log('\n🎉 BIDIRECTIONAL SYNC TEST COMPLETE!');
          console.log('💡 The sync system is working with your credentials!');
          
        } else {
          console.log('❌ Sync failed:', syncResponse.data);
        }
        
      } else {
        console.log('❌ Air/Hair cream not found in WooCommerce products');
        console.log('💡 Available products:', products.slice(0, 5).map(p => p.name));
      }
      
    } catch (error) {
      console.log('❌ Credentials test failed:', error.response?.status, error.response?.statusText);
      if (error.response?.data) {
        console.log('Error details:', error.response.data);
      }
    }
    
  } catch (error) {
    console.error('❌ Update failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

updateWithRealCredentials();
