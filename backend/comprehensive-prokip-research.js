const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');
const axios = require('axios');

const prisma = new PrismaClient();

async function comprehensiveProkipApiResearch() {
  console.log('🔍 Comprehensive Prokip API Research for Stock Management');
  console.log('========================================================');

  try {
    const headers = await prokipService.getAuthHeaders(50);
    
    // 1. Test all possible stock-related endpoints
    console.log('\n1️⃣ Testing all stock-related endpoints...');
    
    const stockEndpoints = [
      // Direct stock endpoints
      { method: 'GET', url: '/connector/api/stock' },
      { method: 'GET', url: '/connector/api/stocks' },
      { method: 'GET', url: '/connector/api/inventory' },
      { method: 'GET', url: '/connector/api/inventories' },
      
      // Stock adjustment endpoints
      { method: 'GET', url: '/connector/api/stock-adjustment' },
      { method: 'GET', url: '/connector/api/stock-adjustments' },
      { method: 'GET', url: '/connector/api/inventory-adjustment' },
      { method: 'GET', url: '/connector/api/inventory-adjustments' },
      { method: 'GET', url: '/connector/api/adjustment' },
      { method: 'GET', url: '/connector/api/adjustments' },
      
      // Product stock endpoints
      { method: 'GET', url: '/connector/api/product-stock' },
      { method: 'GET', url: '/connector/api/product-stocks' },
      { method: 'GET', url: '/connector/api/product/stock' },
      { method: 'GET', url: '/connector/api/products/stock' },
      
      // Transaction endpoints
      { method: 'GET', url: '/connector/api/transactions' },
      { method: 'GET', url: '/connector/api/stock-transactions' },
      { method: 'GET', url: '/connector/api/inventory-transactions' },
      
      // Opening stock endpoints
      { method: 'GET', url: '/connector/api/opening-stock' },
      { method: 'GET', url: '/connector/api/opening-stocks' },
      
      // Purchase endpoints (for negative quantities)
      { method: 'GET', url: '/connector/api/purchase' },
      { method: 'GET', url: '/connector/api/purchases' },
      
      // Sell return endpoints
      { method: 'GET', url: '/connector/api/sell-return' },
      { method: 'GET', url: '/connector/api/sell-returns' }
    ];

    const workingEndpoints = [];
    
    for (const endpoint of stockEndpoints) {
      try {
        const response = await axios({
          method: endpoint.method,
          url: `https://api.prokip.africa${endpoint.url}`,
          headers: { ...headers, 'Content-Type': 'application/json' },
          timeout: 5000
        });
        
        if (response.status !== 404) {
          workingEndpoints.push({
            ...endpoint,
            status: response.status,
            hasData: response.data && Object.keys(response.data).length > 0
          });
          console.log(`✅ ${endpoint.method} ${endpoint.url} - Status: ${response.status}`);
        }
      } catch (error) {
        if (error.response?.status !== 404) {
          workingEndpoints.push({
            ...endpoint,
            status: error.response?.status || 'ERROR',
            error: error.response?.data?.message || error.message
          });
          console.log(`⚠️  ${endpoint.method} ${endpoint.url} - Status: ${error.response?.status || 'ERROR'}`);
        }
      }
    }

    console.log(`\n📊 Found ${workingEndpoints.length} potentially working endpoints`);

    // 2. Test POST requests on working endpoints
    console.log('\n2️⃣ Testing POST requests on promising endpoints...');
    
    const testPayload = {
      location_id: 21237,
      product_id: 4848961,
      quantity: -1,
      adjustment_type: 'sale',
      reason: 'Test stock reduction',
      date: new Date().toISOString().slice(0, 10)
    };

    for (const endpoint of workingEndpoints) {
      if (endpoint.status === 200 || endpoint.status === 201) {
        try {
          const response = await axios.post(
            `https://api.prokip.africa${endpoint.url}`,
            testPayload,
            { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 10000 }
          );
          
          console.log(`🎉 POST ${endpoint.url} SUCCESS!`);
          console.log('   Response:', JSON.stringify(response.data, null, 2));
          
          // Check if stock actually changed
          await new Promise(resolve => setTimeout(resolve, 2000));
          const stockAfter = await prokipService.getInventory(null, 50);
          const stockItem = stockAfter.find(item => item.sku === '4848961');
          console.log(`   Stock after test: ${stockItem ? stockItem.stock : 'Not found'}`);
          
        } catch (error) {
          console.log(`❌ POST ${endpoint.url} failed:`, error.response?.data?.message || error.message);
        }
      }
    }

    // 3. Test product update endpoints for stock management
    console.log('\n3️⃣ Testing product update endpoints...');
    
    const productUpdateEndpoints = [
      { method: 'PUT', url: `/connector/api/product/4848961` },
      { method: 'PATCH', url: `/connector/api/product/4848961` },
      { method: 'PUT', url: `/connector/api/products/4848961` },
      { method: 'PATCH', url: `/connector/api/products/4848961` }
    ];

    const productPayload = {
      opening_stock: 69, // Reduce by 1
      enable_stock: 1
    };

    for (const endpoint of productUpdateEndpoints) {
      try {
        const response = await axios({
          method: endpoint.method,
          url: `https://api.prokip.africa${endpoint.url}`,
          data: productPayload,
          headers: { ...headers, 'Content-Type': 'application/json' },
          timeout: 10000
        });
        
        console.log(`🎉 ${endpoint.method} ${endpoint.url} SUCCESS!`);
        console.log('   Response:', JSON.stringify(response.data, null, 2));
        
        // Check if stock changed
        await new Promise(resolve => setTimeout(resolve, 2000));
        const stockAfter = await prokipService.getInventory(null, 50);
        const stockItem = stockAfter.find(item => item.sku === '4848961');
        console.log(`   Stock after update: ${stockItem ? stockItem.stock : 'Not found'}`);
        
      } catch (error) {
        console.log(`❌ ${endpoint.method} ${endpoint.url} failed:`, error.response?.data?.message || error.message);
      }
    }

    // 4. Test variation update endpoints
    console.log('\n4️⃣ Testing variation update endpoints...');
    
    const variationUpdateEndpoints = [
      { method: 'PUT', url: `/connector/api/product-variation/5216467` },
      { method: 'PATCH', url: `/connector/api/product-variation/5216467` },
      { method: 'PUT', url: `/connector/api/variations/5216467` },
      { method: 'PATCH', url: `/connector/api/variations/5216467` }
    ];

    const variationPayload = {
      default_sell_price: 680,
      opening_stock: 69
    };

    for (const endpoint of variationUpdateEndpoints) {
      try {
        const response = await axios({
          method: endpoint.method,
          url: `https://api.prokip.africa${endpoint.url}`,
          data: variationPayload,
          headers: { ...headers, 'Content-Type': 'application/json' },
          timeout: 10000
        });
        
        console.log(`🎉 ${endpoint.method} ${endpoint.url} SUCCESS!`);
        console.log('   Response:', JSON.stringify(response.data, null, 2));
        
        // Check if stock changed
        await new Promise(resolve => setTimeout(resolve, 2000));
        const stockAfter = await prokipService.getInventory(null, 50);
        const stockItem = stockAfter.find(item => item.sku === '4848961');
        console.log(`   Stock after variation update: ${stockItem ? stockItem.stock : 'Not found'}`);
        
      } catch (error) {
        console.log(`❌ ${endpoint.method} ${endpoint.url} failed:`, error.response?.data?.message || error.message);
      }
    }

    // 5. Test if there are any hidden or undocumented endpoints
    console.log('\n5️⃣ Testing undocumented endpoints...');
    
    const undocumentedEndpoints = [
      '/connector/api/stock-management',
      '/connector/api/inventory-management',
      '/connector/api/stock-control',
      '/connector/api/inventory-control',
      '/connector/api/quantity-adjustment',
      '/connector/api/stock-update',
      '/connector/api/inventory-update'
    ];

    for (const endpoint of undocumentedEndpoints) {
      try {
        const response = await axios.post(
          `https://api.prokip.africa${endpoint}`,
          testPayload,
          { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 5000 }
        );
        
        console.log(`🎉 UNDOCUMENTED ENDPOINT FOUND: ${endpoint}`);
        console.log('   Response:', JSON.stringify(response.data, null, 2));
        
      } catch (error) {
        if (error.response?.status !== 404) {
          console.log(`⚠️  ${endpoint}: ${error.response?.status}`);
        }
      }
    }

    console.log('\n✅ Comprehensive API research completed!');

  } catch (error) {
    console.error('❌ Research failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run comprehensive research
comprehensiveProkipApiResearch();
