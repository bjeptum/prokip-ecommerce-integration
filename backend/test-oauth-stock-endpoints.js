const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testWithOAuthAuthentication() {
  console.log('🔐 Testing with OAuth Authentication');
  console.log('===================================');

  try {
    // 1. Get OAuth token using your provided credentials
    console.log('\n1️⃣ Getting OAuth token...');
    
    let oauthToken = null;
    
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
      
      if (oauthResponse.data.access_token) {
        oauthToken = oauthResponse.data.access_token;
        console.log('✅ OAuth authentication successful');
        console.log(`   Token type: ${oauthResponse.data.token_type}`);
        console.log(`   Expires in: ${oauthResponse.data.expires_in}s`);
      }
      
    } catch (oauthError) {
      console.log('❌ OAuth authentication failed:', oauthError.response?.data || oauthError.message);
      
      // Try with your actual credentials if available
      console.log('\n🔄 Trying with database credentials...');
      
      // Get credentials from database
      const connection = await prisma.prokipConfig.findFirst({ where: { userId: 50 } });
      if (connection && connection.email && connection.password) {
        try {
          const dbOauthResponse = await axios.post(
            'https://api.prokip.africa/oauth/token',
            new URLSearchParams({
              username: connection.email,
              password: connection.password,
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
          
          if (dbOauthResponse.data.access_token) {
            oauthToken = dbOauthResponse.data.access_token;
            console.log('✅ OAuth with DB credentials successful');
          }
        } catch (dbOauthError) {
          console.log('❌ OAuth with DB credentials failed:', dbOauthError.response?.data || dbOauthError.message);
        }
      }
    }

    if (!oauthToken) {
      console.log('❌ No OAuth token available, cannot proceed');
      return;
    }

    // 2. Test stock endpoints with OAuth token
    console.log('\n2️⃣ Testing stock endpoints with OAuth token...');
    
    const oauthHeaders = {
      'Authorization': `Bearer ${oauthToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const endpoints = [
      '/stock-adjustments',
      '/opening-stock',
      '/opening-stock/save',
      '/api/stock-adjustments',
      '/api/opening-stock',
      '/connector/api/stock-adjustments',
      '/connector/api/opening-stock'
    ];

    for (const endpoint of endpoints) {
      try {
        // Test GET first
        console.log(`\n📡 Testing GET ${endpoint}...`);
        
        const getResponse = await axios.get(
          `https://api.prokip.africa${endpoint}`,
          { headers: oauthHeaders, timeout: 8000 }
        );
        
        console.log(`✅ GET ${endpoint} - Status: ${getResponse.status}`);
        
        if (getResponse.data && Object.keys(getResponse.data).length > 0) {
          console.log('   Response:', JSON.stringify(getResponse.data, null, 2));
        }
        
        // If GET works, try POST
        try {
          console.log(`📤 Testing POST ${endpoint}...`);
          
          const testPayload = {
            location_id: 21237,
            adjustment_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
            reason: 'OAuth test stock adjustment',
            products: [{
              product_id: 4848961,
              quantity: -1
            }]
          };

          const postResponse = await axios.post(
            `https://api.prokip.africa${endpoint}`,
            testPayload,
            { headers: oauthHeaders, timeout: 10000 }
          );
          
          console.log(`🎉 POST ${endpoint} SUCCESS!`);
          console.log('   Response:', JSON.stringify(postResponse.data, null, 2));
          
          // Check if stock changed
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Get current stock to verify
          try {
            const stockResponse = await axios.get(
              'https://api.prokip.africa/connector/api/product-stock-report',
              { 
                headers: { 'Authorization': `Bearer ${oauthToken}`, 'Content-Type': 'application/json' },
                params: { product_id: 4848961, location_id: 21237 },
                timeout: 8000
              }
            );
            
            if (stockResponse.data && stockResponse.data.data && stockResponse.data.data.length > 0) {
              const stockInfo = stockResponse.data.data[0];
              console.log(`   Current stock: ${stockInfo.stock}`);
            }
          } catch (stockCheckError) {
            console.log('   Could not verify stock change');
          }
          
          break; // Stop at first successful POST
          
        } catch (postError) {
          console.log(`❌ POST ${endpoint}: ${postError.response?.status || 'ERROR'}`);
        }
        
      } catch (error) {
        if (error.response?.status !== 404) {
          console.log(`⚠️  ${endpoint}: ${error.response?.status || 'ERROR'}`);
        }
      }
    }

    // 3. Test opening-stock with specific payload format
    console.log('\n3️⃣ Testing opening-stock with specific format...');
    
    try {
      const openingStockPayload = {
        location_id: 21237,
        opening_stock_date: new Date().toISOString().slice(0, 10),
        products: [{
          product_id: 4848961,
          quantity: 68 // Reduce by 1 from current 69
        }]
      };

      const response = await axios.post(
        'https://api.prokip.africa/opening-stock',
        openingStockPayload,
        { headers: oauthHeaders, timeout: 15000 }
      );
      
      console.log('🎉 Opening-stock with OAuth SUCCESS!');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      console.log(`❌ Opening-stock with OAuth failed:`, error.response?.data?.message || error.message);
    }

    console.log('\n✅ OAuth authentication testing completed!');

  } catch (error) {
    console.error('❌ Testing failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testWithOAuthAuthentication();
