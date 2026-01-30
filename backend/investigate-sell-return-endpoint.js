const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');
const axios = require('axios');

const prisma = new PrismaClient();

async function investigateSellReturnEndpoint() {
  console.log('🔍 Investigating /connector/api/sell-return Endpoint');
  console.log('==================================================');

  try {
    const headers = await prokipService.getAuthHeaders(50);
    
    // 1. Test GET method first to understand the endpoint
    console.log('\n1️⃣ Testing GET method...');
    
    try {
      const response = await axios.get(
        'https://api.prokip.africa/connector/api/sell-return',
        { headers, timeout: 10000 }
      );
      
      console.log('✅ GET sell-return SUCCESS');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      console.log(`❌ GET sell-return: ${error.response?.data?.message || error.message}`);
    }

    // 2. Test POST method with different payload formats
    console.log('\n2️⃣ Testing POST method with different payloads...');
    
    const payloads = [
      // Format 1: Simple return
      {
        transaction_id: 1,
        quantity: 1,
        product_id: 4848961,
        reason: 'Test return'
      },
      
      // Format 2: Full return structure
      {
        transaction_id: 1,
        transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        products: [{
          product_id: 4848961,
          variation_id: 5216467,
          quantity: 1,
          unit_price: 680
        }],
        discount_amount: 0,
        discount_type: 'fixed'
      },
      
      // Format 3: Array format
      [{
        transaction_id: 1,
        products: [{
          product_id: 4848961,
          quantity: 1
        }]
      }],
      
      // Format 4: Stock reduction format
      {
        location_id: 21237,
        product_id: 4848961,
        quantity: -1,
        adjustment_type: 'sell_return',
        reason: 'Stock reduction via return'
      }
    ];

    for (let i = 0; i < payloads.length; i++) {
      try {
        const response = await axios.post(
          'https://api.prokip.africa/connector/api/sell-return',
          payloads[i],
          { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 10000 }
        );
        
        console.log(`🎉 POST Format ${i + 1} SUCCESS!`);
        console.log('   Response:', JSON.stringify(response.data, null, 2));
        
        // Check if stock changed
        await new Promise(resolve => setTimeout(resolve, 2000));
        const stockAfter = await prokipService.getInventory(null, 50);
        const stockItem = stockAfter.find(item => item.sku === '4848961');
        console.log(`   Stock after Format ${i + 1}: ${stockItem ? stockItem.stock : 'Not found'}`);
        
      } catch (error) {
        console.log(`❌ POST Format ${i + 1}: ${error.response?.data?.message || error.message}`);
      }
    }

    // 3. Test if we can use sell-return to reduce stock by creating a fake return
    console.log('\n3️⃣ Testing stock reduction via sell-return...');
    
    // First, let's get a recent sale to use as transaction_id
    try {
      const salesResponse = await axios.get(
        'https://api.prokip.africa/connector/api/sell?limit=5',
        { headers, timeout: 10000 }
      );
      
      console.log('✅ Retrieved recent sales');
      console.log('   Sales:', JSON.stringify(salesResponse.data, null, 2));
      
      if (salesResponse.data && salesResponse.data.data && salesResponse.data.data.length > 0) {
        const recentSale = salesResponse.data.data[0];
        const transactionId = recentSale.id;
        
        console.log(`Using transaction_id: ${transactionId}`);
        
        // Now try to create a return that reduces stock
        const returnPayload = {
          transaction_id: transactionId,
          transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
          products: [{
            product_id: 4848961,
            variation_id: 5216467,
            quantity: 1,
            unit_price: 680,
            unit_price_inc_tax: 680
          }],
          discount_amount: 0,
          discount_type: 'fixed'
        };

        const returnResponse = await axios.post(
          'https://api.prokip.africa/connector/api/sell-return',
          returnPayload,
          { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 15000 }
        );
        
        console.log('🎉 Sell-return for stock reduction SUCCESS!');
        console.log('   Response:', JSON.stringify(returnResponse.data, null, 2));
        
        // Check if stock changed
        await new Promise(resolve => setTimeout(resolve, 3000));
        const stockAfter = await prokipService.getInventory(null, 50);
        const stockItem = stockAfter.find(item => item.sku === '4848961');
        console.log(`   Stock after sell-return: ${stockItem ? stockItem.stock : 'Not found'}`);
        
      } else {
        console.log('❌ No recent sales found to use for return');
      }
      
    } catch (error) {
      console.log(`❌ Getting sales for return: ${error.response?.data?.message || error.message}`);
    }

    // 4. Test if there are other return-related endpoints
    console.log('\n4️⃣ Testing other return endpoints...');
    
    const returnEndpoints = [
      '/connector/api/sell-returns',
      '/connector/api/return',
      '/connector/api/returns',
      '/connector/api/purchase-return',
      '/connector/api/purchase-returns'
    ];

    for (const endpoint of returnEndpoints) {
      try {
        const response = await axios.get(
          `https://api.prokip.africa${endpoint}`,
          { headers, timeout: 5000 }
        );
        
        console.log(`✅ GET ${endpoint} - Status: ${response.status}`);
        
        if (response.status === 200) {
          // Try POST if GET works
          try {
            const postResponse = await axios.post(
              `https://api.prokip.africa${endpoint}`,
              { product_id: 4848961, quantity: 1 },
              { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 5000 }
            );
            
            console.log(`🎉 POST ${endpoint} SUCCESS!`);
            console.log('   Response:', JSON.stringify(postResponse.data, null, 2));
            
          } catch (postError) {
            console.log(`❌ POST ${endpoint}: ${postError.response?.data?.message || postError.message}`);
          }
        }
        
      } catch (error) {
        if (error.response?.status !== 404) {
          console.log(`⚠️  ${endpoint}: ${error.response?.status}`);
        }
      }
    }

    console.log('\n✅ Sell-return endpoint investigation completed!');

  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run investigation
investigateSellReturnEndpoint();
