require('dotenv').config();

const axios = require('axios');

// Test the correct Prokip API endpoints
async function testCorrectProkipAPI() {
  console.log('🧪 Testing Correct Prokip API Structure');
  
  const baseUrl = process.env.PROKIP_BASE_URL || 'https://api.prokip.africa';
  
  console.log(`🔗 Base URL: ${baseUrl}`);
  
  // Based on the HTML response, this looks like a Laravel web app
  // Let's test the actual API endpoints
  const apiEndpoints = [
    { path: '/api/v1/login', description: 'API v1 login' },
    { path: '/api/login', description: 'Standard API login' },
    { path: '/v1/auth/login', description: 'Auth v1 login' },
    { path: '/auth/login', description: 'Auth login' },
    { path: '/api/auth/login', description: 'API auth login' }
  ];
  
  for (const endpoint of apiEndpoints) {
    try {
      console.log(`\n🧪 Testing: ${endpoint.path} - ${endpoint.description}`);
      
      const response = await axios.post(`${baseUrl}${endpoint.path}`, {
        email: 'test@example.com',
        password: 'testpassword'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest' // This header often helps with Laravel APIs
        },
        timeout: 10000
      });
      
      console.log(`✅ SUCCESS with ${endpoint.path}`);
      console.log('📊 Response:', JSON.stringify(response.data, null, 2));
      return endpoint.path; // Return the working endpoint
      
    } catch (error) {
      if (error.response) {
        console.log(`❌ ${endpoint.path} - Status: ${error.response.status}`);
        
        // If we get JSON error response, the endpoint exists
        if (error.response.headers['content-type']?.includes('application/json')) {
          console.log(`✅ Endpoint ${endpoint.path} EXISTS and returns JSON`);
          console.log('📊 Error response:', JSON.stringify(error.response.data, null, 2));
          return endpoint.path; // This is likely the correct endpoint
        }
      } else {
        console.log(`❌ ${endpoint.path} - Network error: ${error.message}`);
      }
    }
  }
  
  // Test if there's an API documentation or health check
  try {
    console.log('\n🧪 Testing API documentation...');
    const response = await axios.get(`${baseUrl}/api`, {
      headers: {
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    console.log('✅ API documentation found');
    console.log('📊 Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ No API documentation found');
  }
}

// Test with Laravel-specific headers
async function testLaravelAPI() {
  console.log('\n🧪 Testing Laravel-specific API endpoints...');
  
  const baseUrl = process.env.PROKIP_BASE_URL || 'https://api.prokip.africa';
  
  // Laravel often uses these patterns
  const laravelEndpoints = [
    '/api/login',
    '/api/auth/login',
    '/login',
    '/auth/login'
  ];
  
  for (const endpoint of laravelEndpoints) {
    try {
      console.log(`\n🧪 Testing Laravel endpoint: ${endpoint}`);
      
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
      
      console.log(`✅ SUCCESS with ${endpoint}`);
      console.log('📊 Response:', JSON.stringify(response.data, null, 2));
      return endpoint;
      
    } catch (error) {
      if (error.response) {
        const contentType = error.response.headers['content-type'] || '';
        
        if (contentType.includes('application/json')) {
          console.log(`✅ ${endpoint} returns JSON (likely correct endpoint)`);
          console.log('📊 Error:', JSON.stringify(error.response.data, null, 2));
          return endpoint;
        } else {
          console.log(`❌ ${endpoint} - Returns HTML (not API endpoint)`);
        }
      }
    }
  }
}

// Run tests
testCorrectProkipAPI()
  .then((workingEndpoint) => {
    if (workingEndpoint) {
      console.log(`\n🎯 Found working endpoint: ${workingEndpoint}`);
      console.log('📝 Update your prokipUserAuthService.js to use this endpoint');
    } else {
      console.log('\n❌ No working API endpoint found');
      console.log('💡 The API might require different authentication or endpoints');
    }
    return testLaravelAPI();
  })
  .catch(console.error);
