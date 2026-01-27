const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testCredentialsManually() {
  try {
    console.log('🧪 TESTING: WooCommerce credentials manually');
    console.log('=' .repeat(60));
    
    // Your credentials
    const credentials = {
      consumerKey: 'ck_9dd6b146b7abfd64660215805e0913446cd41597338',
      consumerSecret: 'cs_d8e1b8c2cd2c5e5aee3f943971f9e379449baa1e'
    };
    
    // Test different store URLs
    const storeUrls = [
      'https://prowebfunnels.com/kenditrades/',
      'https://prowebfunnels.com/kenditrades',
      'https://learn.prokip.africa/',
      'https://learn.prokip.africa'
    ];
    
    for (let i = 0; i < storeUrls.length; i++) {
      const storeUrl = storeUrls[i];
      console.log(`\n🌐 TESTING STORE URL ${i + 1}: ${storeUrl}`);
      console.log('-'.repeat(40));
      
      const testHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${credentials.consumerKey}:${credentials.consumerSecret}`).toString('base64')}`
      };
      
      try {
        // Test system status
        const statusResponse = await axios.get(`${storeUrl}/wp-json/wc/v3/system_status`, { headers: testHeaders });
        console.log('✅ System status: SUCCESS');
        
        // Test orders
        const ordersResponse = await axios.get(`${storeUrl}/wp-json/wc/v3/orders?per_page=1`, { headers: testHeaders });
        console.log(`✅ Orders: ${ordersResponse.data.length} found`);
        
        // Test products
        const productsResponse = await axios.get(`${storeUrl}/wp-json/wc/v3/products?per_page=1`, { headers: testHeaders });
        console.log(`✅ Products: ${productsResponse.data.length} found`);
        
        // Look for air/hair cream
        if (productsResponse.data.length > 0) {
          const allProductsResponse = await axios.get(`${storeUrl}/wp-json/wc/v3/products?per_page=50`, { headers: testHeaders });
          const allProducts = allProductsResponse.data;
          
          const airCream = allProducts.find(p => 
            p.name && (p.name.toLowerCase().includes('air cream') || p.name.toLowerCase().includes('hair cream')) ||
            p.sku && (p.sku.toLowerCase().includes('air') || p.sku.toLowerCase().includes('cream'))
          );
          
          if (airCream) {
            console.log('✅ FOUND AIR/HAIR CREAM:');
            console.log(`   Name: ${airCream.name}`);
            console.log(`   SKU: ${airCream.sku || 'No SKU'}`);
            console.log(`   Stock: ${airCream.stock_quantity || 0}`);
            console.log(`   Price: ${airCream.price || 'Not specified'}`);
            
            // This is the working URL - update database
            console.log('\n🔄 UPDATING DATABASE WITH WORKING URL...');
            
            const wooConnection = await prisma.connection.findFirst({ 
              where: { platform: 'woocommerce' } 
            });
            
            if (wooConnection) {
              await prisma.connection.update({
                where: { id: wooConnection.id },
                data: {
                  storeUrl: storeUrl,
                  consumerKey: credentials.consumerKey,
                  consumerSecret: credentials.consumerSecret
                }
              });
              
              console.log('✅ Database updated with working URL and credentials!');
              
              // Test bidirectional sync
              console.log('\n🔄 TESTING BIDIRECTIONAL SYNC...');
              console.log('-'.repeat(40));
              
              const syncResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
                headers: { 'Content-Type': 'application/json' }
              });
              
              console.log('✅ Sync response:', syncResponse.status);
              console.log('📊 Results:', JSON.stringify(syncResponse.data, null, 2));
              
              if (syncResponse.data.success) {
                console.log('\n🎉 BIDIRECTIONAL SYNC IS WORKING!');
                console.log('💡 WooCommerce sales will now deduct from Prokip');
                console.log('💡 Prokip sales will now deduct from WooCommerce');
                console.log('💡 Stock levels will stay synchronized!');
                
                return; // Success - exit the loop
              }
            }
          } else {
            console.log('❌ Air/Hair cream not found in this store');
          }
        }
        
      } catch (error) {
        console.log('❌ Failed:', error.response?.status, error.response?.statusText);
        if (error.response?.data) {
          console.log('Error details:', error.response.data);
        }
      }
    }
    
    console.log('\n💡 IF NONE OF THE URLS WORK:');
    console.log('-'.repeat(40));
    console.log('1. Check if WooCommerce REST API is enabled');
    console.log('2. Verify API key permissions (should be Read/Write)');
    console.log('3. Check if there are any IP restrictions');
    console.log('4. Verify the exact store URL');
    console.log('5. Check if WooCommerce version supports REST API v3');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testCredentialsManually();
