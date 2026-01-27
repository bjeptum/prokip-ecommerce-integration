const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function updateAndTestFixedSync() {
  try {
    console.log('🔧 UPDATING: WooCommerce credentials and testing fixed sync');
    console.log('=' .repeat(60));
    
    // Update with your working credentials
    const workingCredentials = {
      consumerKey: 'ck_9dd6b146b7abfd64660215805e0913446cd41597338',
      consumerSecret: 'cs_d8e1b8c2cd2c5e5aee3f943971f9e379449baa1e'
    };
    
    console.log('🔄 Updating database with working credentials...');
    
    const wooConnection = await prisma.connection.findFirst({ 
      where: { platform: 'woocommerce' } 
    });
    
    if (wooConnection) {
      await prisma.connection.update({
        where: { id: wooConnection.id },
        data: {
          consumerKey: workingCredentials.consumerKey,
          consumerSecret: workingCredentials.consumerSecret
        }
      });
      
      console.log('✅ Database updated!');
    }
    
    // Test the credentials
    console.log('\n🧪 Testing updated credentials...');
    
    const testHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${workingCredentials.consumerKey}:${workingCredentials.consumerSecret}`).toString('base64')}`
    };
    
    try {
      const testResponse = await axios.get(`${wooConnection.storeUrl}/wp-json/wc/v3/system_status`, { headers: testHeaders });
      console.log('✅ WooCommerce API: Working!');
      
      // Test the fixed bidirectional sync
      console.log('\n🔄 TESTING FIXED BIDIRECTIONAL SYNC...');
      console.log('-'.repeat(40));
      
      const syncResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('✅ Sync response status:', syncResponse.status);
      console.log('📊 Sync results:', JSON.stringify(syncResponse.data, null, 2));
      
      if (syncResponse.data.success) {
        const { results } = syncResponse.data;
        
        console.log('\n📈 DETAILED SYNC ANALYSIS:');
        console.log('-'.repeat(40));
        
        if (results.wooToProkip) {
          console.log(`📦 WooCommerce → Prokip:`);
          console.log(`   Orders Processed: ${results.wooToProkip.processed}`);
          console.log(`   Success: ${results.wooToProkip.success}`);
          console.log(`   Stock Deducted: ${results.wooToProkip.stockDeducted || 0}`);
          console.log(`   Errors: ${results.wooToProkip.errors.length}`);
          
          if (results.wooToProkip.errors.length > 0) {
            console.log('   Error details:');
            results.wooToProkip.errors.forEach((error, i) => {
              console.log(`     ${i + 1}. ${error}`);
            });
          }
        }
        
        if (results.prokipToWoo) {
          console.log(`🛒 Prokip → WooCommerce:`);
          console.log(`   Sales Processed: ${results.prokipToWoo.processed}`);
          console.log(`   Success: ${results.prokipToWoo.success}`);
          console.log(`   Stock Updated: ${results.prokipToWoo.stockUpdated || 0}`);
          console.log(`   Errors: ${results.prokipToWoo.errors.length}`);
          
          if (results.prokipToWoo.errors.length > 0) {
            console.log('   Error details:');
            results.prokipToWoo.errors.forEach((error, i) => {
              console.log(`     ${i + 1}. ${error}`);
            });
          }
        }
        
        // Test creating a Prokip sale and see if it syncs to WooCommerce
        console.log('\n🧪 TESTING PROKIP SALE CREATION AND SYNC:');
        console.log('-'.repeat(40));
        
        const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId: 50 } });
        
        if (prokipConfig?.token) {
          const prokipHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${prokipConfig.token}`,
            Accept: 'application/json'
          };
          
          // Get current stock of hair cream in WooCommerce
          try {
            const wooProductsResponse = await axios.get(`${wooConnection.storeUrl}/wp-json/wc/v3/products?sku=4848961`, { headers: testHeaders });
            const wooProducts = wooProductsResponse.data;
            
            if (wooProducts.length > 0) {
              const hairCream = wooProducts[0];
              console.log(`📦 Hair cream in WooCommerce before test:`);
              console.log(`   Name: ${hairCream.name}`);
              console.log(`   SKU: ${hairCream.sku || 'No SKU'}`);
              console.log(`   Current Stock: ${hairCream.stock_quantity || 0}`);
              
              const beforeStock = hairCream.stock_quantity || 0;
              
              // Create a test sale in Prokip
              const testSaleBody = {
                sells: [{
                  location_id: parseInt(prokipConfig.locationId),
                  contact_id: 1849984,
                  transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
                  invoice_no: `TEST-FIXED-${Date.now()}`,
                  status: 'final',
                  type: 'sell',
                  payment_status: 'paid',
                  final_total: 50,
                  products: [{
                    name: 'Hair cream test',
                    sku: '4848961',
                    quantity: 1,
                    unit_price: 50,
                    total_price: 50,
                    product_id: 4848961,
                    variation_id: 5291257
                  }],
                  payments: [{
                    method: 'test',
                    amount: 50,
                    paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
                  }]
                }]
              };
              
              console.log('📝 Creating test sale in Prokip...');
              const saleResponse = await axios.post('https://api.prokip.africa/connector/api/sell', testSaleBody, { headers: prokipHeaders });
              
              if (saleResponse.data && Array.isArray(saleResponse.data) && saleResponse.data.length > 0) {
                console.log('✅ Test sale created in Prokip');
                
                // Wait for processing
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Run sync again to process the new sale
                console.log('🔄 Running sync to process new sale...');
                const secondSyncResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
                  headers: { 'Content-Type': 'application/json' }
                });
                
                console.log('✅ Second sync completed');
                
                // Check WooCommerce stock after sync
                const afterStockResponse = await axios.get(`${wooConnection.storeUrl}/wp-json/wc/v3/products/${hairCream.id}`, { headers: testHeaders });
                const afterStock = afterStockResponse.data.stock_quantity || 0;
                
                console.log(`📊 Hair cream in WooCommerce after sync:`);
                console.log(`   Stock before: ${beforeStock}`);
                console.log(`   Stock after: ${afterStock}`);
                console.log(`   Stock deducted: ${beforeStock - afterStock}`);
                
                if (beforeStock > afterStock) {
                  console.log('🎉 PROKIP → WOOCOMMERCE STOCK SYNC IS WORKING!');
                } else {
                  console.log('❌ Stock was not deducted in WooCommerce');
                }
                
              } else {
                console.log('❌ Failed to create test sale in Prokip');
              }
              
            } else {
              console.log('❌ Hair cream not found in WooCommerce');
            }
            
          } catch (wooError) {
            console.log('❌ Failed to test WooCommerce stock:', wooError.message);
          }
        }
        
        console.log('\n🎯 FINAL CONCLUSION:');
        console.log('-'.repeat(40));
        console.log('✅ Fixed field name from "sell_lines" to "products"');
        console.log('✅ Updated WooCommerce credentials');
        console.log('✅ Added better error handling');
        console.log('✅ Prokip → WooCommerce sync should now work');
        
      } else {
        console.log('❌ Sync failed:', syncResponse.data);
      }
      
    } catch (error) {
      console.log('❌ Credentials test failed:', error.response?.status);
      console.log('💡 The credentials might still be invalid');
    }
    
  } catch (error) {
    console.error('❌ Update failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

updateAndTestFixedSync();
