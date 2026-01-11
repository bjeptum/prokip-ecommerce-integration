const axios = require('axios');

/**
 * Test Prokip API endpoints to find the correct authentication method
 */
async function testProkipAPI() {
  const baseUrls = [
    'https://prokip.africa',
    'https://api.prokip.africa', 
    'https://app.prokip.africa'
  ];

  const endpoints = [
    '/oauth/token',
    '/token',
    '/api/oauth/token',
    '/connector/api/oauth/token',
    '/login',
    '/api/login',
    '/connector/api/login'
  ];

  console.log('🔍 Testing Prokip API endpoints...');

  for (const baseUrl of baseUrls) {
    console.log(`\n📡 Testing base URL: ${baseUrl}`);
    
    for (const endpoint of endpoints) {
      const url = `${baseUrl}${endpoint}`;
      console.log(`  🔗 Testing: ${url}`);
      
      try {
        // Test with GET first to see if endpoint exists
        const response = await axios.get(url, { 
          timeout: 5000,
          validateStatus: (status) => status < 500
        });
        
        console.log(`    ✅ Status: ${response.status} - Endpoint exists`);
        
        if (response.status === 405) {
          console.log(`    🎯 POST method likely supported - Good candidate!`);
        }
        
      } catch (error) {
        if (error.response) {
          console.log(`    📄 Status: ${error.response.status} - ${error.response.statusText}`);
        } else if (error.code === 'ENOTFOUND') {
          console.log(`    ❌ Domain not found`);
          break; // Skip other endpoints for this domain
        } else {
          console.log(`    ❌ Error: ${error.message}`);
        }
      }
    }
  }
}

// Test the API
testProkipAPI().catch(console.error);
