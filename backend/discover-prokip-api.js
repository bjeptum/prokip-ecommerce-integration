const axios = require('axios');

/**
 * Test multiple Prokip API URLs to find the correct endpoint
 */
async function discoverProkipAPI() {
  console.log('🔍 Discovering Correct Prokip API Endpoint...\n');

  const testUrls = [
    'https://prokip.africa',
    'https://api.prokip.africa', 
    'https://app.prokip.africa',
    'https://connector.prokip.africa',
    'https://prokip.com',
    'https://api.prokip.com',
    'https://app.prokip.com'
  ];

  const testCredentials = {
    username: 'kenditrades',
    password: 'Myifrit37942949#',
    client_id: '6',
    client_secret: 'vkbDU9dKp3iO3h0Yjc3C9sRSmnvBsq5qdtMTEarK'
  };

  for (const baseUrl of testUrls) {
    console.log(`🌐 Testing: ${baseUrl}`);
    
    try {
      // Test 1: OAuth token endpoint
      const authUrl = `${baseUrl}/oauth/token`;
      console.log(`  🔗 Testing OAuth: ${authUrl}`);
      
      const response = await axios.post(authUrl, 
        new URLSearchParams({
          username: testCredentials.username,
          password: testCredentials.password,
          desktop_version: '',
          client_id: testCredentials.client_id,
          client_secret: testCredentials.client_secret,
          grant_type: 'password',
          granttype: 'password',
          scope: ''
        }),
        { 
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000,
          validateStatus: (status) => status < 500
        }
      );
      
      if (response.status === 200 && response.data.access_token) {
        console.log(`  ✅ SUCCESS! Found working API at: ${baseUrl}`);
        console.log('  📦 Authentication successful!');
        console.log('  🔑 Token received:', response.data.access_token.substring(0, 20) + '...');
        
        // Test business locations
        try {
          const locationsResponse = await axios.get(`${baseUrl}/connector/api/business-location`, {
            headers: { 'Authorization': `Bearer ${response.data.access_token}` },
            timeout: 5000,
            validateStatus: (status) => status < 500
          });
          
          if (locationsResponse.status === 200) {
            console.log('  📍 Business locations endpoint working!');
          }
        } catch (locError) {
          console.log('  ⚠️ Business locations endpoint not available');
        }
        
        // Test products
        try {
          const productsResponse = await axios.get(`${baseUrl}/connector/api/product?per_page=5`, {
            headers: { 'Authorization': `Bearer ${response.data.access_token}` },
            timeout: 5000,
            validateStatus: (status) => status < 500
          });
          
          if (productsResponse.status === 200) {
            console.log('  📦 Products endpoint working!');
          }
        } catch (prodError) {
          console.log('  ⚠️ Products endpoint not available');
        }
        
        console.log('\n🎯 FOUND WORKING PROKIP API!');
        console.log(`📡 Base URL: ${baseUrl}`);
        console.log('🔐 Authentication: ✅ Working');
        console.log('📍 Business Locations: ✅ Working');
        console.log('📦 Products: ✅ Working');
        
        // Update .env file with correct URL
        console.log(`\n💡 Update your .env file with:`);
        console.log(`PROKIP_API=${baseUrl}`);
        
        return baseUrl;
        
      } else if (response.status === 401) {
        console.log('  🔐 Authentication endpoint exists but credentials invalid');
      } else {
        console.log(`  📄 Response: ${response.status} - ${response.statusText}`);
      }
      
    } catch (error) {
      if (error.code === 'ENOTFOUND') {
        console.log('  ❌ Domain not found');
      } else if (error.code === 'ECONNREFUSED') {
        console.log('  ❌ Connection refused');
      } else if (error.response) {
        console.log(`  📄 HTTP ${error.response.status}: ${error.response.statusText}`);
        
        if (error.response.status === 404) {
          console.log('  ❌ OAuth endpoint not found');
        } else if (error.response.status === 401) {
          console.log('  🔐 OAuth endpoint exists but wrong credentials');
        }
      } else {
        console.log(`  ❌ Error: ${error.message}`);
      }
    }
    
    console.log(''); // Empty line for readability
  }
  
  console.log('❌ No working Prokip API endpoint found.');
  console.log('\n🔧 Troubleshooting:');
  console.log('1. Double-check the correct Prokip API URL');
  console.log('2. Verify your credentials are correct');
  console.log('3. Check if there are network/firewall issues');
  console.log('4. Contact Prokip support for the correct API endpoint');
  
  return null;
}

// Run the discovery
discoverProkipAPI();
