const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');
const axios = require('axios');

const prisma = new PrismaClient();

async function investigateProductStockReport() {
  console.log('🔍 Investigating Product Stock Report Endpoint');
  console.log('==========================================');

  try {
    // 1. Test the product stock report endpoint
    console.log('\n1️⃣ Testing product stock report endpoint...');
    
    const headers = await prokipService.getAuthHeaders(50);
    
    try {
      const response = await axios.get(
        'https://api.prokip.africa/connector/api/product-stock-report',
        { headers, timeout: 10000 }
      );
      
      console.log('✅ Product stock report works!');
      console.log('   Response structure:');
      console.log(JSON.stringify(response.data, null, 2));
      
      // Look for our test product
      const testData = response.data.data?.find(item => item.sku === '4848961');
      if (testData) {
        console.log(`\n📊 Test product (SKU 4848961):`);
        console.log(`   Current stock: ${testData.stock}`);
        console.log(`   Total sold: ${testData.total_sold}`);
        console.log(`   Total adjusted: ${testData.total_adjusted}`);
        console.log(`   Enable stock: ${testData.enable_stock}`);
        console.log(`   Location: ${testData.location_name || 'All locations'}`);
      }
      
    } catch (error) {
      console.log('❌ Product stock report failed:', error.response?.data || error.message);
    }

    // 2. Check if there are any stock adjustment endpoints that work
    console.log('\n2️⃣ Testing stock adjustment endpoints...');
    
    const adjustmentEndpoints = [
      { method: 'POST', url: '/connector/api/stock-adjustments' },
      { method: 'POST', url: '/connector/api/stock-adjustment' },
      { method: 'POST', url: '/connector/api/inventory-adjustments' },
      { method: 'POST', url: '/connector/api/inventory-adjustment' },
      { method: 'PUT', url: '/connector/api/product/4848961/stock' },
      { method: 'PATCH', url: '/connector/api/product/4848961/stock' }
    ];

    for (const endpoint of adjustmentEndpoints) {
      try {
        const testPayload = {
          location_id: 21237,
          product_id: 4848961,
          quantity: -1,
          adjustment_type: 'sale',
          reason: 'Test adjustment',
          date: new Date().toISOString().slice(0, 10)
        };

        const response = await axios({
          method: endpoint.method,
          url: `https://api.prokip.africa${endpoint.url}`,
          data: testPayload,
          headers: { ...headers, 'Content-Type': 'application/json' },
          timeout: 5000
        });
        
        console.log(`✅ ${endpoint.method} ${endpoint.url} - SUCCESS`);
        console.log('   Response:', JSON.stringify(response.data, null, 2));
        break; // Stop at first successful endpoint
        
      } catch (error) {
        if (error.response?.status === 404) {
          console.log(`❌ ${endpoint.method} ${endpoint.url} - Not Found`);
        } else if (error.response?.status === 405) {
          console.log(`⚠️  ${endpoint.method} ${endpoint.url} - Method Not Allowed`);
        } else {
          console.log(`❌ ${endpoint.method} ${endpoint.url} - ${error.response?.status || 'Error'}`);
        }
      }
    }

    // 3. Try to understand if stock is managed through a different mechanism
    console.log('\n3️⃣ Testing if stock is managed through purchase orders...');
    
    try {
      const purchasePayload = {
        location_id: 21237,
        transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        invoice_no: 'STOCK-TEST-' + Date.now(),
        status: 'received',
        final_total: 0,
        products: [{
          product_id: 4848961,
          variation_id: 4848961,
          quantity: -1, // Negative to reduce stock
          unit_price: 0,
          purchase_price: 0
        }]
      };

      const response = await axios.post(
        'https://api.prokip.africa/connector/api/purchase',
        purchasePayload,
        { headers, timeout: 10000 }
      );
      
      console.log('✅ Purchase order with negative quantity works!');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      console.log('❌ Purchase order approach failed:', error.response?.data || error.message);
    }

    // 4. Check final stock levels
    console.log('\n4️⃣ Final stock check...');
    
    const currentStock = await prokipService.getInventory(null, 50);
    const stockItem = currentStock.find(item => item.sku === '4848961');
    console.log(`   SKU 4848961: ${stockItem ? stockItem.stock : 'Not found'} units`);

    console.log('\n✅ Investigation completed!');

  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run investigation
investigateProductStockReport();
