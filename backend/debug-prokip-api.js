require('dotenv').config();

const axios = require('axios');

// Test the exact Prokip API endpoint that's failing
async function debugProkipAPI() {
  console.log('🔍 Debugging Prokip API Endpoint');
  
  const baseUrl = process.env.PROKIP_BASE_URL || 'https://api.prokip.africa';
  
  console.log(`🔗 Base URL: ${baseUrl}`);
  
  // Test different endpoints to find the correct one
  const endpoints = [
    '/api/v1/login',
    '/api/login',
    '/login',
    '/auth/login',
    '/oauth/token'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n🧪 Testing: ${baseUrl}${endpoint}`);
      
      const response = await axios.post(`${baseUrl}${endpoint}`, {
        email: 'test@example.com',
        password: 'testpassword'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 10000
      });
      
      console.log(`✅ SUCCESS: ${endpoint}`);
      console.log('📊 Response:', JSON.stringify(response.data, null, 2));
      return endpoint;
      
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const contentType = error.response.headers['content-type'] || '';
        
        console.log(`❌ ${endpoint} - Status: ${status}`);
        
        if (status === 401 || status === 422) {
          if (contentType.includes('application/json')) {
            console.log(`✅ ${endpoint} returns JSON (correct endpoint!)`);
            console.log('📊 Error response:', JSON.stringify(error.response.data, null, 2));
            return endpoint;
          }
        }
      } else {
        console.log(`❌ ${endpoint} - Network error: ${error.message}`);
      }
    }
  }
  
  // If no endpoint works, let's check what's actually available
  try {
    console.log('\n🧪 Checking what endpoints are available...');
    const response = await axios.get(`${baseUrl}/`, {
      timeout: 10000
    });
    
    console.log('✅ Base URL accessible');
    console.log('📊 Response type:', typeof response.data);
    console.log('📊 Content type:', response.headers['content-type']);
    
    // Look for API documentation or routes
    if (typeof response.data === 'string') {
      if (response.data.includes('api')) {
        console.log('✅ Found API references in HTML response');
        // Extract API endpoints from HTML
        const apiMatches = response.data.match(/\/api\/[^\s"']+/g);
        if (apiMatches) {
          console.log('🔍 Found potential API endpoints:', [...new Set(apiMatches)]);
        }
      }
    }
    
  } catch (error) {
    console.log('❌ Base URL not accessible:', error.message);
  }
}

// Test with a real browser-like request
async function testBrowserLikeRequest() {
  console.log('\n🌐 Testing browser-like request...');
  
  const baseUrl = process.env.PROKIP_BASE_URL || 'https://api.prokip.africa';
  
  try {
    const response = await axios.post(`${baseUrl}/login`, {
      email: 'test@example.com',
      password: 'testpassword'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    console.log('✅ Browser-like request successful');
    console.log('📊 Response type:', typeof response.data);
    
  } catch (error) {
    console.log('❌ Browser-like request failed');
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Content-Type: ${error.response.headers['content-type']}`);
    }
  }
}

// Run debugging
debugProkipAPI()
  .then((workingEndpoint) => {
    if (workingEndpoint) {
      console.log(`\n🎯 Found working endpoint: ${workingEndpoint}`);
      console.log('📝 Update prokipUserAuthService.js to use this endpoint');
    }
    return testBrowserLikeRequest();
  })
  .catch(console.error);
