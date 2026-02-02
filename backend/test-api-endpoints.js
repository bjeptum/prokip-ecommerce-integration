require('dotenv').config();

const axios = require('axios');

// Test Prokip authentication with different endpoints
async function testProkipEndpoints() {
  console.log('🧪 Testing Prokip API Endpoints for Authentication');
  
  const baseUrl = process.env.PROKIP_BASE_URL || 'https://api.prokip.africa';
  
  console.log(`🔗 Base URL: ${baseUrl}`);
  
  // Test different possible login endpoints
  const endpoints = [
    { path: '/api/login', method: 'POST', description: 'Standard API login' },
    { path: '/login', method: 'POST', description: 'Simple login' },
    { path: '/auth/login', method: 'POST', description: 'Auth login' },
    { path: '/oauth/token', method: 'POST', description: 'OAuth token endpoint' },
    { path: '/v1/api/login', method: 'POST', description: 'Versioned API login' },
    { path: '/api/v1/login', method: 'POST', description: 'API versioned login' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n🧪 Testing: ${endpoint.path} - ${endpoint.description}`);
      
      const response = await axios.post(`${baseUrl}${endpoint.path}`, {
        email: 'test@example.com',
        password: 'testpassword'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      });
      
      console.log(`✅ SUCCESS with ${endpoint.path}`);
      console.log('📊 Response:', JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      if (error.response) {
        console.log(`❌ ${endpoint.path} - Status: ${error.response.status} ${error.response.statusText}`);
        
        // If we get a 401 or 422, the endpoint exists but credentials are wrong
        if (error.response.status === 401 || error.response.status === 422) {
          console.log(`✅ Endpoint ${endpoint.path} EXISTS (just needs real credentials)`);
          console.log('📊 Error response:', JSON.stringify(error.response.data, null, 2));
        }
      } else if (error.request) {
        console.log(`❌ ${endpoint.path} - Network error: ${error.message}`);
      } else {
        console.log(`❌ ${endpoint.path} - Error: ${error.message}`);
      }
    }
  }
  
  // Test if the base API is accessible
  try {
    console.log('\n🧪 Testing base API accessibility...');
    const response = await axios.get(`${baseUrl}/`, {
      timeout: 10000
    });
    console.log('✅ Base API accessible');
    console.log('📊 Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Base API not accessible');
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
    }
  }
}

// Test with form data (some APIs use form-encoded login)
async function testFormLogin() {
  console.log('\n🧪 Testing form-encoded login...');
  
  const baseUrl = process.env.PROKIP_BASE_URL || 'https://api.prokip.africa';
  
  try {
    const response = await axios.post(`${baseUrl}/oauth/token`, 
      `grant_type=password&username=test@example.com&password=testpassword&client_id=test&client_secret=test`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 10000
      }
    );
    
    console.log('✅ Form login successful');
    console.log('📊 Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    if (error.response) {
      console.log(`❌ Form login - Status: ${error.response.status}`);
      if (error.response.status === 401 || error.response.status === 422) {
        console.log('✅ Form login endpoint EXISTS (just needs real credentials)');
      }
    } else {
      console.log('❌ Form login - Network error');
    }
  }
}

// Run tests
testProkipEndpoints()
  .then(() => testFormLogin())
  .catch(console.error);
