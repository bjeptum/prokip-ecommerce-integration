require('dotenv').config();

const axios = require('axios');

// Test Prokip authentication with real credentials
async function testProkipAuthentication() {
  console.log('🧪 Testing Prokip Authentication');
  
  // Get credentials from environment or use test values
  const email = process.env.PROKIP_USERNAME || 'your_prokip_email@example.com';
  const password = process.env.PROKIP_PASSWORD || 'your_prokip_password';
  const baseUrl = process.env.PROKIP_BASE_URL || 'https://api.prokip.africa';
  
  console.log(`📧 Email: ${email}`);
  console.log(`🔗 Base URL: ${baseUrl}`);
  console.log(`🔑 Password: ${password ? 'Set' : 'Not set'}`);
  
  if (email === 'your_prokip_email@example.com' || password === 'your_prokip_password') {
    console.log('⚠️ Using placeholder credentials. Please update .env with real Prokip credentials.');
    console.log('📝 Update these lines in your .env file:');
    console.log('   PROKIP_USERNAME=your_real_prokip_email@example.com');
    console.log('   PROKIP_PASSWORD=your_real_prokip_password');
    return;
  }
  
  try {
    console.log('\n🔐 Attempting login to Prokip API...');
    
    // Test the exact same login endpoint used in the service
    const loginResponse = await axios.post(`${baseUrl}/api/login`, {
      email,
      password
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log('✅ Login successful!');
    console.log('📊 Response:', JSON.stringify(loginResponse.data, null, 2));
    
    if (loginResponse.data.token) {
      console.log('🎫 JWT Token received:', loginResponse.data.token.substring(0, 50) + '...');
      console.log('👤 User info:', loginResponse.data.user);
      
      // Test if token works for API calls
      console.log('\n🧪 Testing authenticated API call...');
      const testResponse = await axios.get(`${baseUrl}/api/user/profile`, {
        headers: {
          'Authorization': `Bearer ${loginResponse.data.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      console.log('✅ Authenticated API call successful!');
      console.log('📊 Profile data:', JSON.stringify(testResponse.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Authentication failed:');
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Status Text: ${error.response.statusText}`);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 401) {
        console.log('\n💡 Possible solutions:');
        console.log('1. Check if email and password are correct');
        console.log('2. Verify the Prokip API endpoint URL');
        console.log('3. Make sure the account is active');
        console.log('4. Check if API access is enabled for your account');
      } else if (error.response.status === 404) {
        console.log('\n💡 Possible solutions:');
        console.log('1. Verify the API endpoint: /api/login');
        console.log('2. Check if the base URL is correct');
        console.log('3. Make sure the API is accessible');
      }
    } else if (error.request) {
      console.error('Network error - could not reach Prokip API');
      console.error('Error:', error.message);
      console.log('\n💡 Possible solutions:');
      console.log('1. Check internet connection');
      console.log('2. Verify the base URL is correct');
      console.log('3. Check if firewall is blocking the request');
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Test different possible endpoints
async function testMultipleEndpoints() {
  console.log('\n🔍 Testing different possible Prokip API endpoints...');
  
  const baseUrl = process.env.PROKIP_BASE_URL || 'https://api.prokip.africa';
  const email = process.env.PROKIP_USERNAME;
  const password = process.env.PROKIP_PASSWORD;
  
  if (!email || !password || email === 'your_prokip_email@example.com') {
    console.log('⚠️ Please set real credentials in .env first');
    return;
  }
  
  const endpoints = [
    '/api/login',
    '/login',
    '/auth/login',
    '/oauth/token',
    '/v1/api/login',
    '/v2/api/login'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n🧪 Testing endpoint: ${endpoint}`);
      
      const response = await axios.post(`${baseUrl}${endpoint}`, {
        email,
        password
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      });
      
      console.log(`✅ SUCCESS with ${endpoint}`);
      console.log('📊 Response:', JSON.stringify(response.data, null, 2));
      break;
      
    } catch (error) {
      if (error.response) {
        console.log(`❌ ${endpoint} - Status: ${error.response.status}`);
      } else {
        console.log(`❌ ${endpoint} - Network error: ${error.message}`);
      }
    }
  }
}

// Run tests
testProkipAuthentication()
  .then(() => testMultipleEndpoints())
  .catch(console.error);
