/**
 * Test alternative approaches for stock deduction
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

async function testAlternativeStockDeduction() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Testing alternative stock deduction approaches...\n');

    // Get configurations
    const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId: 50 } });

    if (!prokipConfig) {
      console.error('❌ Missing Prokip config');
      return;
    }

    // Get Prokip headers
    const prokipHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };

    // Test 1: Check if there's a direct stock adjustment endpoint
    console.log('🧪 Test 1: Looking for stock adjustment endpoints...');
    
    // Try to find what endpoints are available
    const commonEndpoints = [
      '/stock-adjustment',
      '/inventory/adjust',
      '/product-stock-update',
      '/stock/update',
      '/inventory/update'
    ];

    for (const endpoint of commonEndpoints) {
      try {
        const response = await axios.get(`https://api.prokip.africa/connector/api${endpoint}`, { headers: prokipHeaders });
        console.log(`✅ Found endpoint: ${endpoint}`);
      } catch (error) {
        // Expected to fail for most endpoints
      }
    }

    // Test 2: Try using a different sale structure
    console.log('\n🧪 Test 2: Try different sale structure...');
    
    // Maybe the issue is with the nested sells structure
    const directSellBody = {
      location_id: parseInt(prokipConfig.locationId),
      contact_id: 1849984,
      transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      invoice_no: `DIRECT-${Date.now()}`,
      status: 'final',
      type: 'sell',
      payment_status: 'paid',
      final_total: 100,
      products: [{
        name: 'Test Product',
        sku: 'TEST-SKU',
        quantity: 1,
        unit_price: 100,
        total_price: 100,
        product_id: 4922924,
        variation_id: 4922924
      }],
      payments: [{
        method: 'test',
        amount: 100,
        paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
      }]
    };

    try {
      const response = await axios.post('https://api.prokip.africa/connector/api/sell', directSellBody, { headers: prokipHeaders });
      
      if (response.data && !response.data.original?.error) {
        console.log('✅ Direct structure worked!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
      } else {
        console.log('❌ Direct structure failed:', response.data?.original?.error?.message);
      }
    } catch (error) {
      console.log('❌ Direct structure error:', error.response?.data?.original?.error?.message);
    }

    // Test 3: Check current stock levels
    console.log('\n🧪 Test 3: Check current stock levels...');
    try {
      const stockResponse = await axios.get('https://api.prokip.africa/connector/api/product-stock-report', { headers: prokipHeaders });
      console.log('📊 Current stock levels:');
      if (stockResponse.data && stockResponse.data.length > 0) {
        stockResponse.data.slice(0, 3).forEach(item => {
          console.log(`  - ${item.product_name || item.name} (SKU: ${item.sku}): ${item.stock || item.qty_available}`);
        });
      }
    } catch (error) {
      console.log('❌ Could not fetch stock levels');
    }

    // Test 4: Try to find working sales by checking existing ones
    console.log('\n🧪 Test 4: Check existing successful sales...');
    try {
      const salesResponse = await axios.get('https://api.prokip.africa/connector/api/sell?per_page=5', { headers: prokipHeaders });
      const sales = salesResponse.data.data || salesResponse.data;
      
      if (sales && sales.length > 0) {
        console.log('📊 Recent sales structure:');
        sales.forEach((sale, index) => {
          console.log(`  Sale ${index + 1}: ID ${sale.id}, Status: ${sale.status}`);
          if (sale.products && sale.products.length > 0) {
            sale.products.forEach(product => {
              console.log(`    - Product: ${product.name}, variation_id: ${product.variation_id}, product_id: ${product.product_id}`);
            });
          }
        });
      }
    } catch (error) {
      console.log('❌ Could not fetch existing sales');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAlternativeStockDeduction();
