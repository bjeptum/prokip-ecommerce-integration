const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');
const axios = require('axios');

const prisma = new PrismaClient();

async function testCorrectSellV2Implementation() {
  console.log('🔧 Testing Correct Sell-V2 Implementation');
  console.log('======================================');

  try {
    // 1. Get current stock
    console.log('\n1️⃣ Getting current stock levels...');
    const currentStock = await prokipService.getInventory(null, 50);
    
    const testSku = '4848961';
    const stockItem = currentStock.find(item => item.sku === testSku);
    const initialStock = stockItem ? parseInt(stockItem.stock) : 0;
    
    console.log(`   SKU ${testSku}: ${initialStock} units`);

    // 2. Test sell-v2 with correct payload format (no contact_id)
    console.log('\n2️⃣ Testing sell-v2 with correct payload...');
    
    const sellV2Payload = {
      location_id: 21237,
      transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      invoice_no: 'SELLV2-' + Date.now(),
      status: 'final',
      type: 'sell',
      payment_status: 'paid',
      final_total: 680,
      discount_amount: 0,
      discount_type: 'fixed',
      products: [{
        product_id: 4848961,
        variation_id: 4848961,
        quantity: 1,
        unit_price: 680,
        unit_price_inc_tax: 680
      }],
      payments: [{
        method: 'cash',
        amount: 680,
        paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
      }],
      platform_source: 'woocommerce',
      platform_order_id: Date.now().toString()
    };

    try {
      const headers = await prokipService.getAuthHeaders(50);
      
      console.log('🔧 Sending sell-v2 request...');
      console.log('   Payload structure:', JSON.stringify(sellV2Payload, null, 2));
      
      const response = await axios.post(
        'https://api.prokip.africa/connector/api/sell-v2',
        sellV2Payload,
        { headers, timeout: 15000 }
      );
      
      console.log('✅ Sell-v2 response received');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      
      // Check if there's an error in the response
      if (response.data && response.data[0] && response.data[0].original && response.data[0].original.error) {
        console.log('⚠️  Error in response:', response.data[0].original.error);
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
      console.log('🎉 SUCCESS! Stock was automatically reduced by sell-v2!');
    } else {
      console.log('❌ Stock was not reduced');
    }

    // 4. Test with the exact same format as current working sell but using sell-v2
    console.log('\n4️⃣ Testing sell-v2 with working sell format...');
    
    const workingFormatPayload = {
      location_id: 21237,
      transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      invoice_no: 'SELLV2-WORKING-' + Date.now(),
      status: 'final',
      type: 'sell',
      payment_status: 'paid',
      final_total: 680,
      discount_amount: 0,
      discount_type: 'fixed',
      products: [{
        product_id: 4848961,
        variation_id: 4848961,
        quantity: 1,
        unit_price: 680,
        unit_price_inc_tax: 680
      }],
      payments: [{
        method: 'cash',
        amount: 680,
        paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
      }],
      platform_source: 'woocommerce',
      platform_order_id: Date.now().toString()
    };

    try {
      const headers = await prokipService.getAuthHeaders(50);
      
      const response = await axios.post(
        'https://api.prokip.africa/connector/api/sell-v2',
        workingFormatPayload,
        { headers, timeout: 15000 }
      );
      
      console.log('✅ Working format sell-v2 response:');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      console.log('❌ Working format sell-v2 failed:', error.response?.data || error.message);
    }

    // 5. Final stock check
    console.log('\n5️⃣ Final stock check...');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const finalStock = await prokipService.getInventory(null, 50);
    const finalStockItem = finalStock.find(item => item.sku === testSku);
    const finalQty = finalStockItem ? parseInt(finalStockItem.stock) : 0;
    const finalChange = finalQty - initialStock;
    
    console.log(`   SKU ${testSku}: ${initialStock} → ${finalQty} (${finalChange > 0 ? '+' : ''}${finalChange})`);
    
    if (finalChange < 0) {
      console.log('🎉 SUCCESS! Sell-v2 automatically reduces stock!');
    } else {
      console.log('❌ Sell-v2 does not reduce stock automatically');
    }

    console.log('\n✅ Sell-v2 testing completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run test
testCorrectSellV2Implementation();
