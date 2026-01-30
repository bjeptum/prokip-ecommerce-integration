const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');
const axios = require('axios');

const prisma = new PrismaClient();

async function investigateProductStockEndpoint() {
  console.log('🔍 Investigating /connector/api/product/stock Endpoint');
  console.log('===================================================');

  try {
    const headers = await prokipService.getAuthHeaders(50);
    
    // 1. Test the product stock endpoint with different parameters
    console.log('\n1️⃣ Testing product stock endpoint parameters...');
    
    const testParams = [
      {},
      { product_id: 4848961 },
      { sku: '4848961' },
      { location_id: 21237 },
      { product_id: 4848961, location_id: 21237 },
      { sku: '4848961', location_id: 21237 }
    ];

    for (const params of testParams) {
      try {
        const response = await axios.get(
          'https://api.prokip.africa/connector/api/product/stock',
          { 
            headers, 
            params,
            timeout: 10000 
          }
        );
        
        console.log(`✅ Params ${JSON.stringify(params)} - SUCCESS`);
        console.log('   Response:', JSON.stringify(response.data, null, 2));
        
      } catch (error) {
        console.log(`❌ Params ${JSON.stringify(params)} - ${error.response?.status || 'ERROR'}`);
      }
    }

    // 2. Check if there are POST/PUT/PATCH methods available
    console.log('\n2️⃣ Testing different HTTP methods...');
    
    const methods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    const testPayload = {
      product_id: 4848961,
      location_id: 21237,
      quantity: 69,
      adjustment_type: 'manual'
    };

    for (const method of methods) {
      try {
        const response = await axios({
          method,
          url: 'https://api.prokip.africa/connector/api/product/stock',
          data: testPayload,
          headers: { ...headers, 'Content-Type': 'application/json' },
          timeout: 10000
        });
        
        console.log(`🎉 ${method} method SUCCESS!`);
        console.log('   Response:', JSON.stringify(response.data, null, 2));
        
        // Check if stock changed
        await new Promise(resolve => setTimeout(resolve, 2000));
        const stockAfter = await prokipService.getInventory(null, 50);
        const stockItem = stockAfter.find(item => item.sku === '4848961');
        console.log(`   Stock after ${method}: ${stockItem ? stockItem.stock : 'Not found'}`);
        
      } catch (error) {
        console.log(`❌ ${method} method: ${error.response?.data?.message || error.message}`);
      }
    }

    // 3. Test if there are sub-endpoints
    console.log('\n3️⃣ Testing sub-endpoints...');
    
    const subEndpoints = [
      '/connector/api/product/stock/adjust',
      '/connector/api/product/stock/update',
      '/connector/api/product/stock/set',
      '/connector/api/product/stock/4848961',
      '/connector/api/product/stock/product/4848961',
      '/connector/api/product/stock/sku/4848961'
    ];

    for (const endpoint of subEndpoints) {
      try {
        const response = await axios.post(
          `https://api.prokip.africa${endpoint}`,
          { quantity: 69, location_id: 21237 },
          { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 5000 }
        );
        
        console.log(`🎉 ${endpoint} SUCCESS!`);
        console.log('   Response:', JSON.stringify(response.data, null, 2));
        
      } catch (error) {
        if (error.response?.status !== 404) {
          console.log(`⚠️  ${endpoint}: ${error.response?.status}`);
        }
      }
    }

    // 4. Test if the endpoint supports query parameters for updates
    console.log('\n4️⃣ Testing query parameter updates...');
    
    const queryParams = [
      '?product_id=4848961&quantity=69&location_id=21237',
      '?sku=4848961&stock=69',
      '?update_stock=true&product_id=4848961&new_quantity=69'
    ];

    for (const query of queryParams) {
      try {
        const response = await axios.post(
          `https://api.prokip.africa/connector/api/product/stock${query}`,
          {},
          { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 5000 }
        );
        
        console.log(`🎉 Query ${query} SUCCESS!`);
        console.log('   Response:', JSON.stringify(response.data, null, 2));
        
      } catch (error) {
        console.log(`❌ Query ${query}: ${error.response?.data?.message || error.message}`);
      }
    }

    // 5. Test if there are any stock management endpoints we missed
    console.log('\n5️⃣ Testing additional stock management endpoints...');
    
    const additionalEndpoints = [
      '/connector/api/stock',
      '/connector/api/inventory',
      '/connector/api/quantity',
      '/connector/api/stock-level',
      '/connector/api/inventory-level'
    ];

    for (const endpoint of additionalEndpoints) {
      try {
        // Test GET first
        const getResponse = await axios.get(
          `https://api.prokip.africa${endpoint}`,
          { headers, timeout: 5000 }
        );
        
        console.log(`✅ GET ${endpoint} - Status: ${getResponse.status}`);
        
        // If GET works, try POST
        try {
          const postResponse = await axios.post(
            `https://api.prokip.africa${endpoint}`,
            { product_id: 4848961, quantity: 69 },
            { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 5000 }
          );
          
          console.log(`🎉 POST ${endpoint} SUCCESS!`);
          console.log('   Response:', JSON.stringify(postResponse.data, null, 2));
          
        } catch (postError) {
          console.log(`❌ POST ${endpoint}: ${postError.response?.data?.message || postError.message}`);
        }
        
      } catch (error) {
        if (error.response?.status !== 404) {
          console.log(`⚠️  ${endpoint}: ${error.response?.status}`);
        }
      }
    }

    console.log('\n✅ Product stock endpoint investigation completed!');

  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run investigation
investigateProductStockEndpoint();
