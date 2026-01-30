const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');
const axios = require('axios');

const prisma = new PrismaClient();

async function testAlternativeStockEndpoints() {
  console.log('🧪 Testing Alternative Stock Endpoint Patterns');
  console.log('=============================================');

  try {
    const headers = await prokipService.getAuthHeaders(50);
    
    // 1. Test different URL patterns based on OAuth pattern
    console.log('\n1️⃣ Testing alternative endpoint patterns...');
    
    const endpointPatterns = [
      // Direct patterns (without /connector/api/)
      '/stock-adjustments',
      '/stock-adjustment', 
      '/opening-stock',
      '/opening-stock/save',
      
      // API patterns
      '/api/stock-adjustments',
      '/api/stock-adjustment',
      '/api/opening-stock',
      '/api/opening-stock/save',
      
      // Connector patterns without /api
      '/connector/stock-adjustments',
      '/connector/stock-adjustment',
      '/connector/opening-stock',
      '/connector/opening-stock/save',
      
      // Laravel resource patterns
      '/stock-adjustments',
      '/opening-stock',
      
      // Versioned patterns
      '/api/v1/stock-adjustments',
      '/api/v1/opening-stock'
    ];

    const workingEndpoints = [];
    
    for (const endpoint of endpointPatterns) {
      try {
        // Test GET first
        const getResponse = await axios.get(
          `https://api.prokip.africa${endpoint}`,
          { headers, timeout: 5000 }
        );
        
        if (getResponse.status !== 404) {
          workingEndpoints.push({
            endpoint,
            method: 'GET',
            status: getResponse.status,
            hasData: getResponse.data && Object.keys(getResponse.data).length > 0
          });
          console.log(`✅ GET ${endpoint} - Status: ${getResponse.status}`);
          
          // If GET works, try POST
          try {
            const testPayload = {
              location_id: 21237,
              product_id: 4848961,
              quantity: -1,
              reason: 'Test stock adjustment'
            };

            const postResponse = await axios.post(
              `https://api.prokip.africa${endpoint}`,
              testPayload,
              { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 8000 }
            );
            
            console.log(`🎉 POST ${endpoint} SUCCESS!`);
            console.log('   Response:', JSON.stringify(postResponse.data, null, 2));
            
            workingEndpoints.push({
              endpoint,
              method: 'POST',
              status: postResponse.status,
              response: postResponse.data
            });
            
          } catch (postError) {
            console.log(`⚠️  POST ${endpoint}: ${postError.response?.status || 'ERROR'}`);
          }
        }
        
      } catch (error) {
        if (error.response?.status !== 404) {
          console.log(`⚠️  ${endpoint}: ${error.response?.status}`);
        }
      }
    }

    console.log(`\n📊 Found ${workingEndpoints.length} working endpoints`);

    // 2. Test with OAuth-style authentication if needed
    console.log('\n2️⃣ Testing with OAuth authentication...');
    
    try {
      const oauthResponse = await axios.post(
        'https://api.prokip.africa/oauth/token',
        new URLSearchParams({
          username: 'test@example.com',
          password: '123456',
          desktop_version: '',
          client_id: '6',
          client_secret: 'vkbDU9dKp3iO3h0Yjc3C9sRSmnvBsq5qdtMTEarK',
          grant_type: 'password',
          granttype: 'password',
          scope: ''
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000
        }
      );
      
      console.log('✅ OAuth authentication successful');
      
      if (oauthResponse.data.access_token) {
        const oauthHeaders = {
          'Authorization': `Bearer ${oauthResponse.data.access_token}`,
          'Content-Type': 'application/json'
        };
        
        // Test stock adjustments with OAuth token
        for (const endpoint of ['/stock-adjustments', '/opening-stock']) {
          try {
            const testPayload = {
              location_id: 21237,
              products: [{
                product_id: 4848961,
                quantity: -1
              }]
            };

            const response = await axios.post(
              `https://api.prokip.africa${endpoint}`,
              testPayload,
              { headers: oauthHeaders, timeout: 8000 }
            );
            
            console.log(`🎉 OAuth POST ${endpoint} SUCCESS!`);
            console.log('   Response:', JSON.stringify(response.data, null, 2));
            
          } catch (error) {
            console.log(`❌ OAuth POST ${endpoint} failed:`, error.response?.data?.message || error.message);
          }
        }
      }
      
    } catch (oauthError) {
      console.log('❌ OAuth authentication failed:', oauthError.response?.data || oauthError.message);
    }

    // 3. Test if there are any stock-related endpoints we missed
    console.log('\n3️⃣ Testing comprehensive stock endpoint patterns...');
    
    const comprehensivePatterns = [
      // Stock management
      '/stock',
      '/stocks',
      '/stock/adjust',
      '/stock/update',
      '/stock/set',
      
      // Inventory management
      '/inventory',
      '/inventories',
      '/inventory/adjust',
      '/inventory/update',
      '/inventory/set',
      
      // Product stock
      '/product/stock',
      '/product/stock/adjust',
      '/product/stock/update',
      
      // Transaction based
      '/transactions/stock',
      '/transactions/inventory',
      '/transaction/stock-adjustment'
    ];

    for (const endpoint of comprehensivePatterns) {
      try {
        const response = await axios.post(
          `https://api.prokip.africa${endpoint}`,
          {
            location_id: 21237,
            product_id: 4848961,
            quantity: 69,
            reason: 'Test'
          },
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

    console.log('\n✅ Alternative endpoint testing completed!');

  } catch (error) {
    console.error('❌ Testing failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testAlternativeStockEndpoints();
