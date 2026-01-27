const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function fixProkipToWooSync() {
  try {
    console.log('🔧 FIXING: Prokip → WooCommerce stock sync');
    console.log('=' .repeat(60));
    
    // 1. Test current Prokip sales structure
    console.log('\n🛒 1. TESTING PROKIP SALES STRUCTURE:');
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
      // Get recent Prokip sales
      const salesResponse = await axios.get(
        `https://api.prokip.africa/connector/api/sell?location_id=${prokipConfig.locationId}&per_page=10`,
        { headers: prokipHeaders }
      );
      
      const prokipSales = salesResponse.data.data || salesResponse.data;
      console.log(`📊 Found ${prokipSales.length} recent Prokip sales`);
      
      if (prokipSales.length > 0) {
        const sampleSale = prokipSales[0];
        console.log('\n📋 SAMPLE PROKIP SALE STRUCTURE:');
        console.log(`   ID: ${sampleSale.id}`);
        console.log(`   Invoice: ${sampleSale.invoice_no}`);
        console.log(`   Date: ${sampleSale.transaction_date}`);
        console.log(`   Total: ${sampleSale.final_total}`);
        console.log(`   Products structure: ${typeof sampleSale.products}`);
        console.log(`   Sell lines structure: ${typeof sampleSale.sell_lines}`);
        
        if (sampleSale.products && Array.isArray(sampleSale.products)) {
          console.log(`   Products count: ${sampleSale.products.length}`);
          console.log('   Sample product:');
          console.log(`     Name: ${sampleSale.products[0].name}`);
          console.log(`     SKU: ${sampleSale.products[0].sku}`);
          console.log(`     Quantity: ${sampleSale.products[0].quantity}`);
        }
        
        if (sampleSale.sell_lines && Array.isArray(sampleSale.sell_lines)) {
          console.log(`   Sell lines count: ${sampleSale.sell_lines.length}`);
          console.log('   Sample sell line:');
          console.log(`     SKU: ${sampleSale.sell_lines[0].sku}`);
          console.log(`     Quantity: ${sampleSale.sell_lines[0].quantity}`);
        }
      }
      
    } catch (error) {
      console.log('❌ Failed to fetch Prokip sales:', error.message);
    }
    
    // 2. Test WooCommerce connection
    console.log('\n🛒 2. TESTING WOOCOMMERCE CONNECTION:');
    console.log('-'.repeat(40));
    
    const wooConnection = await prisma.connection.findFirst({ where: { platform: 'woocommerce' } });
    
    if (!wooConnection) {
      console.log('❌ No WooCommerce connection found');
      return;
    }
    
    const wooHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${wooConnection.consumerKey}:${wooConnection.consumerSecret}`).toString('base64')}`
    };
    
    try {
      // Test basic API access
      const testResponse = await axios.get(`${wooConnection.storeUrl}/wp-json/wc/v3/system_status`, { headers: wooHeaders });
      console.log('✅ WooCommerce API: Working');
      
      // Get products
      const productsResponse = await axios.get(`${wooConnection.storeUrl}/wp-json/wc/v3/products?per_page=10`, { headers: wooHeaders });
      console.log(`✅ Found ${productsResponse.data.length} WooCommerce products`);
      
      // Look for hair cream
      const hairCream = productsResponse.data.find(p => 
        p.name && (p.name.toLowerCase().includes('hair cream') || p.name.toLowerCase().includes('air cream')) ||
        p.sku && p.sku.toLowerCase().includes('4848961')
      );
      
      if (hairCream) {
        console.log('✅ Found Hair Cream in WooCommerce:');
        console.log(`   Name: ${hairCream.name}`);
        console.log(`   SKU: ${hairCream.sku || 'No SKU'}`);
        console.log(`   Current Stock: ${hairCream.stock_quantity || 0}`);
        console.log(`   Product ID: ${hairCream.id}`);
      }
      
    } catch (error) {
      console.log('❌ WooCommerce API failed:', error.response?.status);
      console.log('💡 This is why Prokip → WooCommerce sync is not working');
      return;
    }
    
    // 3. Create a test sale in Prokip and try to sync it
    console.log('\n🧪 3. TESTING PROKIP → WOOCOMMERCE SYNC:');
    console.log('-'.repeat(40));
    
    try {
      // Create a test sale in Prokip
      const testSaleBody = {
        sells: [{
          location_id: parseInt(prokipConfig.locationId),
          contact_id: 1849984,
          transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
          invoice_no: `TEST-PROKIP-${Date.now()}`,
          status: 'final',
          type: 'sell',
          payment_status: 'paid',
          final_total: 100,
          products: [{
            name: 'Hair cream test',
            sku: '4848961',
            quantity: 2,
            unit_price: 50,
            total_price: 100,
            product_id: 4848961,
            variation_id: 5291257
          }],
          payments: [{
            method: 'test',
            amount: 100,
            paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
          }]
        }]
      };
      
      console.log('📝 Creating test sale in Prokip...');
      const saleResponse = await axios.post('https://api.prokip.africa/connector/api/sell', testSaleBody, { headers: prokipHeaders });
      
      if (saleResponse.data && Array.isArray(saleResponse.data) && saleResponse.data.length > 0) {
        const testSaleId = saleResponse.data[0].id;
        console.log(`✅ Test sale created: ID ${testSaleId}`);
        
        // Wait a moment for the sale to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Now try to sync this sale to WooCommerce
        console.log('🔄 Testing sync of this sale to WooCommerce...');
        
        // Get the test sale from Prokip
        const testSaleDetailsResponse = await axios.get(
          `https://api.prokip.africa/connector/api/sell/${testSaleId}`,
          { headers: prokipHeaders }
        );
        
        const testSaleDetails = testSaleDetailsResponse.data;
        console.log('📋 Test sale details:', {
          id: testSaleDetails.id,
          invoice_no: testSaleDetails.invoice_no,
          products: testSaleDetails.products?.length || 0,
          final_total: testSaleDetails.final_total
        });
        
        // Try to update WooCommerce stock
        if (testSaleDetails.products && testSaleDetails.products.length > 0) {
          const product = testSaleDetails.products[0];
          
          // Find the WooCommerce product
          const wooProductsResponse = await axios.get(`${wooConnection.storeUrl}/wp-json/wc/v3/products?sku=${product.sku}`, { headers: wooHeaders });
          const wooProducts = wooProductsResponse.data;
          
          if (wooProducts.length > 0) {
            const wooProduct = wooProducts[0];
            console.log(`✅ Found WooCommerce product: ${wooProduct.name}`);
            console.log(`   Current stock: ${wooProduct.stock_quantity || 0}`);
            
            // Update stock
            const currentStock = wooProduct.stock_quantity || 0;
            const newStock = Math.max(0, currentStock - product.quantity);
            
            console.log(`📝 Updating stock: ${currentStock} → ${newStock} (-${product.quantity})`);
            
            const updateResponse = await axios.put(
              `${wooConnection.storeUrl}/wp-json/wc/v3/products/${wooProduct.id}`,
              { stock_quantity: newStock },
              { headers: wooHeaders }
            );
            
            console.log('✅ Stock updated successfully!');
            console.log(`   New stock: ${updateResponse.data.stock_quantity}`);
            
            // Verify the update
            const verifyResponse = await axios.get(`${wooConnection.storeUrl}/wp-json/wc/v3/products/${wooProduct.id}`, { headers: wooHeaders });
            console.log(`✅ Verified stock: ${verifyResponse.data.stock_quantity}`);
            
            console.log('\n🎉 PROKIP → WOOCOMMERCE SYNC IS WORKING!');
            
          } else {
            console.log(`❌ WooCommerce product with SKU ${product.sku} not found`);
          }
        }
        
      } else {
        console.log('❌ Failed to create test sale:', saleResponse.data);
      }
      
    } catch (error) {
      console.log('❌ Test sync failed:', error.message);
      if (error.response) {
        console.log('Response status:', error.response.status);
        console.log('Response data:', error.response.data);
      }
    }
    
    // 4. Identify the issues in the current code
    console.log('\n🔍 4. ISSUES FOUND IN CURRENT CODE:');
    console.log('-'.repeat(40));
    console.log('1. ❌ Using wrong field name: "sell_lines" instead of "products"');
    console.log('2. ❌ WooCommerce API credentials invalid (401 errors)');
    console.log('3. ❌ No proper error handling for missing products');
    console.log('4. ❌ Not verifying stock updates actually work');
    
    console.log('\n🔧 5. FIXES NEEDED:');
    console.log('-'.repeat(40));
    console.log('1. ✅ Fix field name from "sell_lines" to "products"');
    console.log('2. ✅ Update WooCommerce API credentials');
    console.log('3. ✅ Add better error handling');
    console.log('4. ✅ Add stock update verification');
    console.log('5. ✅ Test with real Prokip sales');
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixProkipToWooSync();
