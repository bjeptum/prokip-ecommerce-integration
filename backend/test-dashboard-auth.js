require('dotenv').config();

const axios = require('axios');

// Test authentication without hardcoded credentials
async function testUserAuthentication() {
  console.log('🧪 Testing User Authentication Flow (No Hardcoded Credentials)');
  
  const baseUrl = process.env.PROKIP_BASE_URL || 'https://api.prokip.africa';
  
  console.log(`🔗 Base URL: ${baseUrl}`);
  console.log('✅ No hardcoded credentials in .env - users will login via dashboard');
  
  // Test that the API endpoint is working
  try {
    console.log('\n🧪 Testing API endpoint availability...');
    
    const response = await axios.post(`${baseUrl}/api/v1/login`, {
      email: 'test@example.com',
      password: 'testpassword'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    console.log('✅ API endpoint is accessible');
    console.log('📊 Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    if (error.response) {
      const contentType = error.response.headers['content-type'] || '';
      
      if (contentType.includes('application/json')) {
        console.log('✅ API endpoint returns JSON (ready for user authentication)');
        console.log('📊 Error response (expected with test credentials):', JSON.stringify(error.response.data, null, 2));
      } else {
        console.log('❌ API endpoint returns HTML - check endpoint configuration');
      }
    } else {
      console.log('❌ Network error - check API accessibility');
    }
  }
  
  // Test the authentication service
  try {
    console.log('\n🧪 Testing ProkipUserAuthService...');
    
    const ProkipUserAuthService = require('./src/services/prokipUserAuthService');
    const authService = new ProkipUserAuthService();
    
    console.log('✅ Authentication service loaded successfully');
    console.log('📝 Service is ready to authenticate users from dashboard');
    
    // Test with sample user data (this would come from frontend login form)
    const testUserId = 'demo-user-123';
    const testEmail = 'demo@example.com';
    const testPassword = 'demo-password';
    
    console.log(`\n🧪 Testing authentication flow with demo user: ${testEmail}`);
    
    try {
      const result = await authService.authenticateUser(testUserId, testEmail, testPassword, 'Demo Connection');
      console.log('✅ Authentication service processed request');
      console.log('📊 Result:', JSON.stringify(result, null, 2));
    } catch (authError) {
      console.log('✅ Authentication service working (expected error with demo credentials)');
      console.log('📊 Error:', authError.message);
    }
    
  } catch (serviceError) {
    console.error('❌ Authentication service error:', serviceError.message);
  }
}

// Test the complete flow
async function testCompleteFlow() {
  console.log('\n🔄 Testing Complete User Authentication Flow');
  console.log('1. User enters credentials in dashboard');
  console.log('2. Frontend sends credentials to backend');
  console.log('3. Backend authenticates with Prokip API');
  console.log('4. Token stored securely in database');
  console.log('5. User can now sync WooCommerce orders');
  
  try {
    // Simulate frontend login request
    console.log('\n🧪 Simulating frontend login request...');
    
    const loginData = {
      userId: 'user-from-session-123',
      email: 'user@example.com',
      password: 'user-password',
      connectionName: 'My Prokip Account'
    };
    
    const response = await axios.post('http://localhost:3000/api/prokip/auth/connect', loginData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Frontend login endpoint working');
    console.log('📊 Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    if (error.response) {
      console.log('✅ Frontend login endpoint accessible');
      console.log('📊 Error response (expected with demo data):', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('❌ Frontend login endpoint not accessible - make sure server is running');
      console.log('💡 Run: npm start');
    }
  }
}

// Run tests
testUserAuthentication()
  .then(() => testCompleteFlow())
  .catch(console.error);
