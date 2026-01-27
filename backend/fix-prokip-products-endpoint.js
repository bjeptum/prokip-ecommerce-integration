const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function fixProkipProductsEndpoint() {
  try {
    console.log('🔧 FIXING: Prokip products endpoint');
    console.log('=' .repeat(60));
    
    // Test the current endpoint with proper authentication
    console.log('\n🧪 TESTING WITH PROPER AUTH:');
    console.log('-'.repeat(40));
    
    try {
      // First get a valid token by logging in
      console.log('🔐 Getting authentication token...');
      
      const loginResponse = await axios.post('http://localhost:3000/auth/login', {
        email: 'test@example.com', // You might need to update this
        password: 'password'
      });
      
      if (loginResponse.data.token) {
        console.log('✅ Got authentication token');
        
        // Now test products endpoint
        const productsResponse = await axios.get('http://localhost:3000/prokip/products', {
          headers: {
            'Authorization': `Bearer ${loginResponse.data.token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Products endpoint working!');
        console.log('📊 Products found:', productsResponse.data.products?.length || 0);
        
        // Look for air cream
        const airCream = productsResponse.data.products?.find(p => 
          p.name && p.name.toLowerCase().includes('air cream') ||
          p.sku && p.sku.toLowerCase().includes('air')
        );
        
        if (airCream) {
          console.log('✅ Found air cream:');
          console.log(`   Name: ${airCream.name}`);
          console.log(`   SKU: ${airCream.sku}`);
          console.log(`   Stock: ${airCream.stock || airCream.quantity || 'Not specified'}`);
        }
        
      } else {
        console.log('❌ Login failed - no token received');
      }
      
    } catch (error) {
      console.log('❌ Test failed:', error.message);
      if (error.response) {
        console.log('Response status:', error.response.status);
        console.log('Response data:', error.response.data);
      }
    }
    
    // Check if the issue is with Prokip API connectivity
    console.log('\n🛒 TESTING PROKIP API CONNECTIVITY:');
    console.log('-'.repeat(40));
    
    const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId: 50 } });
    
    if (!prokipConfig?.token) {
      console.log('❌ Prokip config not found');
      return;
    }
    
    console.log('🔐 Testing Prokip API with existing token...');
    
    const prokipHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };
    
    try {
      const productsResponse = await axios.get('https://api.prokip.africa/connector/api/product?per_page=10', { headers: prokipHeaders });
      console.log('✅ Prokip API working!');
      console.log('📊 Products count:', productsResponse.data.data?.length || 0);
      
      // Look for air cream
      const airCream = productsResponse.data.data?.find(p => 
        p.name && p.name.toLowerCase().includes('air cream') ||
        p.sku && p.sku.toLowerCase().includes('air')
      );
      
      if (airCream) {
        console.log('✅ Found air cream in Prokip:');
        console.log(`   Name: ${airCream.name}`);
        console.log(`   SKU: ${airCream.sku}`);
        console.log(`   ID: ${airCream.id}`);
        
        // Get stock for this product
        try {
          const stockResponse = await axios.get(
            `https://api.prokip.africa/connector/api/product-stock-report?location_id=${prokipConfig.locationId}`,
            { headers: prokipHeaders }
          );
          
          const stockData = Array.isArray(stockResponse.data) ? stockResponse.data : (stockResponse.data.data || []);
          const productStock = stockData.find(s => s.sku === airCream.sku);
          
          if (productStock) {
            console.log(`   Stock in Prokip: ${productStock.stock || productStock.qty_available || 0}`);
            
            // Now check WooCommerce stock
            console.log('\n🛒 CHECKING WOOCOMMERCE STOCK:');
            console.log('-'.repeat(40));
            
            const wooConnection = await prisma.connection.findFirst({ where: { platform: 'woocommerce' } });
            
            if (wooConnection) {
              try {
                const wooHeaders = {
                  'Content-Type': 'application/json',
                  Authorization: `Basic ${Buffer.from(`${wooConnection.consumerKey}:${wooConnection.consumerSecret}`).toString('base64')}`
                };
                
                // Search for product by SKU
                const searchResponse = await axios.get(`${wooConnection.storeUrl}/wp-json/wc/v3/products?sku=${airCream.sku}`, { headers: wooHeaders });
                const wooProducts = searchResponse.data;
                
                if (wooProducts.length > 0) {
                  const wooProduct = wooProducts[0];
                  console.log(`   Stock in WooCommerce: ${wooProduct.stock_quantity || 0}`);
                  console.log(`   Product name: ${wooProduct.name}`);
                  console.log(`   Product SKU: ${wooProduct.sku || 'No SKU'}`);
                  
                  // Compare stocks
                  const prokipStock = productStock.stock || productStock.qty_available || 0;
                  const wooStock = wooProduct.stock_quantity || 0;
                  
                  console.log(`\n📊 STOCK COMPARISON:`);
                  console.log(`   Prokip: ${prokipStock}`);
                  console.log(`   WooCommerce: ${wooStock}`);
                  console.log(`   Difference: ${Math.abs(prokipStock - wooStock)}`);
                  
                  if (prokipStock !== wooStock) {
                    console.log('❌ STOCK LEVELS DO NOT MATCH!');
                    console.log('💡 This is why sync is needed');
                    
                    // Test sync to fix this
                    console.log('\n🔄 TESTING SYNC TO FIX STOCK MISMATCH:');
                    console.log('-'.repeat(40));
                    
                    const syncResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
                      headers: { 'Content-Type': 'application/json' }
                    });
                    
                    console.log('✅ Sync response:', syncResponse.data);
                    
                  } else {
                    console.log('✅ Stock levels match!');
                  }
                  
                } else {
                  console.log('❌ Product not found in WooCommerce');
                }
                
              } catch (wooError) {
                console.log('❌ WooCommerce API failed:', wooError.response?.status);
              }
            }
            
          } else {
            console.log('❌ Stock not found for air cream');
          }
          
        } catch (stockError) {
          console.log('❌ Failed to get stock:', stockError.message);
        }
        
      } else {
        console.log('❌ Air cream not found in Prokip products');
        console.log('💡 First 5 products:');
        productsResponse.data.data?.slice(0, 5).forEach((p, i) => {
          console.log(`   ${i + 1}. ${p.name} (SKU: ${p.sku || 'No SKU'})`);
        });
      }
      
    } catch (error) {
      console.log('❌ Prokip API failed:', error.message);
      if (error.response) {
        console.log('Response status:', error.response.status);
        console.log('Response data:', error.response.data);
      }
    }
    
    console.log('\n💡 SOLUTIONS:');
    console.log('-'.repeat(40));
    console.log('1. Fix authentication in frontend (use proper token)');
    console.log('2. Ensure Prokip API connectivity');
    console.log('3. Update WooCommerce credentials to fix stock sync');
    console.log('4. Run bidirectional sync to match stock levels');
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixProkipProductsEndpoint();
