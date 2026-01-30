const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');

const prisma = new PrismaClient();

async function investigateSellPayload() {
  console.log('🔍 Investigating Correct Sell Payload Structure');
  console.log('==============================================');

  try {
    // 1. Check what payload is currently being used successfully
    console.log('\n1️⃣ Examining current working payload...');
    
    // Get the current mapping function to see what payload it creates
    const { mapOrderToProkipSell } = require('./src/services/prokipMapper');
    
    const mockOrder = {
      id: Date.now(),
      number: Date.now().toString(),
      status: 'completed',
      date_created: new Date().toISOString(),
      total: '680.00',
      line_items: [{
        id: 1,
        name: 'Hair cream',
        sku: '4848961',
        quantity: 1,
        price: '680.00',
        total_tax: '0.00'
      }]
    };

    try {
      const currentPayload = await mapOrderToProkipSell(mockOrder, 21237, 'woocommerce', 50);
      console.log('✅ Current working payload structure:');
      console.log(JSON.stringify(currentPayload, null, 2));
      
      // Test this payload with sell endpoint
      console.log('\n2️⃣ Testing current payload with sell endpoint...');
      
      const axios = require('axios');
      const headers = await prokipService.getAuthHeaders(50);
      
      const response = await axios.post(
        'https://api.prokip.africa/connector/api/sell',
        currentPayload,
        { headers, timeout: 15000 }
      );
      
      console.log('✅ Current sell endpoint works!');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      console.log('❌ Current payload failed:', error.response?.data || error.message);
    }

    // 3. Try to find the correct sell-v2 payload format
    console.log('\n3️⃣ Testing different sell-v2 payload formats...');
    
    const headers = await prokipService.getAuthHeaders(50);
    
    // Format 1: Simple sell-v2 payload
    const format1 = {
      location_id: 21237,
      transaction_date: '2026-01-28 04:01:52',
      invoice_no: 'TEST-' + Date.now(),
      status: 'final',
      products: [{
        product_id: 4848961,
        quantity: 1,
        unit_price: 680
      }]
    };

    try {
      const response = await axios.post(
        'https://api.prokip.africa/connector/api/sell-v2',
        format1,
        { headers, timeout: 10000 }
      );
      console.log('✅ Format 1 works!');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log('❌ Format 1 failed:', error.response?.data?.message || error.message);
    }

    // Format 2: With required fields
    const format2 = {
      location_id: 21237,
      transaction_date: '2026-01-28 04:01:52',
      invoice_no: 'TEST2-' + Date.now(),
      status: 'final',
      products: [{
        product_id: 4848961,
        variation_id: 5216467,
        quantity: 1,
        unit_price: 680,
        tax_rate_id: 0
      }],
      payments: [{
        amount: 680,
        method: 'cash'
      }]
    };

    try {
      const response = await axios.post(
        'https://api.prokip.africa/connector/api/sell-v2',
        format2,
        { headers, timeout: 10000 }
      );
      console.log('✅ Format 2 works!');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log('❌ Format 2 failed:', error.response?.data?.message || error.message);
    }

    // Format 3: Array wrapper
    const format3 = {
      sells: [{
        location_id: 21237,
        transaction_date: '2026-01-28 04:01:52',
        invoice_no: 'TEST3-' + Date.now(),
        status: 'final',
        products: [{
          product_id: 4848961,
          variation_id: 5216467,
          quantity: 1,
          unit_price: 680
        }],
        payments: [{
          amount: 680,
          method: 'cash'
        }]
      }]
    };

    try {
      const response = await axios.post(
        'https://api.prokip.africa/connector/api/sell-v2',
        format3,
        { headers, timeout: 10000 }
      );
      console.log('✅ Format 3 works!');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log('❌ Format 3 failed:', error.response?.data?.message || error.message);
    }

    // 4. Check if there are any stock management endpoints we missed
    console.log('\n4️⃣ Searching for stock management endpoints...');
    
    const stockEndpoints = [
      '/connector/api/stock-management',
      '/connector/api/inventory-management',
      '/connector/api/product-stock',
      '/connector/api/adjust-stock',
      '/connector/api/update-stock'
    ];

    for (const endpoint of stockEndpoints) {
      try {
        const response = await axios.get(
          `https://api.prokip.africa${endpoint}`,
          { headers, timeout: 5000 }
        );
        console.log(`✅ Found endpoint: ${endpoint}`);
      } catch (error) {
        if (error.response?.status !== 404) {
          console.log(`⚠️  ${endpoint}: ${error.response?.status}`);
        }
      }
    }

    console.log('\n✅ Investigation completed!');

  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run investigation
investigateSellPayload();
