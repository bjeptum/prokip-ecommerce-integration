const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');

const prisma = new PrismaClient();

async function testSellV2Endpoint() {
  console.log('🧪 Testing Sell-V2 Endpoint for Stock Reduction');
  console.log('===============================================');

  try {
    // 1. Get current stock
    console.log('\n1️⃣ Getting current stock levels...');
    const currentStock = await prokipService.getInventory(null, 50);
    
    const testSku = '4848961';
    const stockItem = currentStock.find(item => item.sku === testSku);
    const initialStock = stockItem ? parseInt(stockItem.stock) : 0;
    
    console.log(`   SKU ${testSku}: ${initialStock} units`);

    // 2. Test sell-v2 endpoint with proper payload
    console.log('\n2️⃣ Testing sell-v2 endpoint...');
    
    const sellV2Payload = {
      location_id: 21237,
      contact_id: null, // No customer for test
      transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      invoice_no: 'SELLV2-' + Date.now(),
      source: 'woocommerce',
      status: 'final',
      is_quotation: false,
      products: [{
        product_id: 4848961,
        variation_id: 5216467, // From product investigation
        quantity: 1,
        unit_price: 680, // From product data
        tax_rate_id: 0,
        discount_amount: 0,
        discount_type: 'percentage'
      }],
      payments: [{
        amount: 680,
        method: 'cash'
      }]
    };

    try {
      const axios = require('axios');
      const headers = await prokipService.getAuthHeaders(50);
      
      console.log('🔧 Sending sell-v2 request...');
      console.log('   Payload:', JSON.stringify(sellV2Payload, null, 2));
      
      const response = await axios.post(
        'https://api.prokip.africa/connector/api/sell-v2',
        sellV2Payload,
        { headers, timeout: 15000 }
      );
      
      console.log('✅ Sell-v2 response received');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      
      // Check if there's an error in the response
      if (response.data && response.data.error) {
        console.log('⚠️  Error in response:', response.data.error);
      } else {
        console.log('✅ Sale appears successful');
      }
      
    } catch (error) {
      console.log('❌ Sell-v2 failed:', error.response?.data || error.message);
      if (error.response?.status === 422) {
        console.log('   Validation errors:', error.response.data.errors);
      }
    }

    // 3. Check stock after sale
    console.log('\n3️⃣ Checking stock after sale...');
    
    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const newStock = await prokipService.getInventory(null, 50);
    const newStockItem = newStock.find(item => item.sku === testSku);
    const currentQty = newStockItem ? parseInt(newStockItem.stock) : 0;
    const change = currentQty - initialStock;
    
    console.log(`   SKU ${testSku}: ${initialStock} → ${currentQty} (${change > 0 ? '+' : ''}${change})`);
    
    if (change < 0) {
      console.log('✅ SUCCESS! Stock was automatically reduced by sell-v2!');
    } else {
      console.log('❌ Stock was not reduced');
    }

    // 4. Test with multiple products
    console.log('\n4️⃣ Testing with multiple products...');
    
    const multiProductPayload = {
      location_id: 21237,
      contact_id: null,
      transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      invoice_no: 'MULTI-' + Date.now(),
      source: 'woocommerce',
      status: 'final',
      is_quotation: false,
      products: [
        {
          product_id: 4848961,
          variation_id: 5216467,
          quantity: 1,
          unit_price: 680,
          tax_rate_id: 0,
          discount_amount: 0,
          discount_type: 'percentage'
        },
        {
          product_id: 4815445,
          variation_id: 5216468, // Assuming similar variation ID
          quantity: 1,
          unit_price: 400, // From product data
          tax_rate_id: 0,
          discount_amount: 0,
          discount_type: 'percentage'
        }
      ],
      payments: [{
        amount: 1080,
        method: 'cash'
      }]
    };

    try {
      const axios = require('axios');
      const headers = await prokipService.getAuthHeaders(50);
      
      console.log('🔧 Sending multi-product sell-v2 request...');
      
      const response = await axios.post(
        'https://api.prokip.africa/connector/api/sell-v2',
        multiProductPayload,
        { headers, timeout: 15000 }
      );
      
      console.log('✅ Multi-product sell-v2 response received');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      console.log('❌ Multi-product sell-v2 failed:', error.response?.data || error.message);
    }

    // 5. Final stock check
    console.log('\n5️⃣ Final stock check...');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const finalStock = await prokipService.getInventory(null, 50);
    const finalStockItem = finalStock.find(item => item.sku === testSku);
    const finalQty = finalStockItem ? parseInt(finalStockItem.stock) : 0;
    const finalChange = finalQty - initialStock;
    
    console.log(`   SKU ${testSku}: ${initialStock} → ${finalQty} (${finalChange > 0 ? '+' : ''}${finalChange})`);
    
    console.log('\n✅ Sell-v2 testing completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run test
testSellV2Endpoint();
