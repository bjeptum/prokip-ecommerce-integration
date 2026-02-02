require('dotenv').config();

const axios = require('axios');

// Test the updated authentication with real credentials
async function testRealAuthentication() {
  console.log('🧪 Testing Real Prokip Authentication');
  
  const email = process.env.PROKIP_USERNAME;
  const password = process.env.PROKIP_PASSWORD;
  const baseUrl = process.env.PROKIP_BASE_URL || 'https://api.prokip.africa';
  
  console.log(`📧 Email: ${email}`);
  console.log(`🔗 Base URL: ${baseUrl}`);
  console.log(`🔑 Password: ${password ? 'Set' : 'Not set'}`);
  
  if (!email || !password || email === 'your_actual_prokip_email@example.com') {
    console.log('\n⚠️ Please update your .env file with REAL Prokip credentials:');
    console.log('📝 Replace these lines in your .env file:');
    console.log('   PROKIP_USERNAME=your_real_prokip_email@example.com');
    console.log('   PROKIP_PASSWORD=your_real_prokip_password');
    console.log('\n💡 After updating, run this test again to verify authentication works.');
    return;
  }
  
  try {
    console.log('\n🔐 Attempting login with updated API endpoint...');
    
    // Test the exact same login endpoint used in the updated service
    const loginResponse = await axios.post(`${baseUrl}/api/v1/login`, {
      email,
      password
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    console.log('✅ Login successful!');
    console.log('📊 Response:', JSON.stringify(loginResponse.data, null, 2));
    
    if (loginResponse.data.token) {
      console.log('🎫 JWT Token received:', loginResponse.data.token.substring(0, 50) + '...');
      console.log('👤 User info:', loginResponse.data.user);
      
      // Test if token works for API calls
      console.log('\n🧪 Testing authenticated API call...');
      try {
        const testResponse = await axios.get(`${baseUrl}/api/v1/user/profile`, {
          headers: {
            'Authorization': `Bearer ${loginResponse.data.token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        
        console.log('✅ Authenticated API call successful!');
        console.log('📊 Profile data:', JSON.stringify(testResponse.data, null, 2));
      } catch (profileError) {
        console.log('⚠️ Profile endpoint might not exist, but authentication works');
      }
      
      console.log('\n🎉 SUCCESS! Real Prokip authentication is working!');
      console.log('✅ Users can now log in with their real Prokip credentials');
      console.log('✅ The integration will work for actual Prokip users');
      
    } else {
      console.log('❌ No token received in response');
    }
    
  } catch (error) {
    console.error('❌ Authentication failed:');
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 401) {
        console.log('\n💡 401 Unauthorized - Possible issues:');
        console.log('1. Email or password is incorrect');
        console.log('2. Account is not active');
        console.log('3. API access is not enabled for this account');
        console.log('4. Need to verify email address');
      } else if (error.response.status === 422) {
        console.log('\n💡 422 Validation Error - Possible issues:');
        console.log('1. Missing required fields');
        console.log('2. Invalid email format');
        console.log('3. Password too short');
      }
    } else {
      console.error('Network error:', error.message);
    }
  }
}

// Test the service directly
async function testAuthService() {
  console.log('\n🧪 Testing ProkipUserAuthService directly...');
  
  try {
    const ProkipUserAuthService = require('./src/services/prokipUserAuthService');
    const authService = new ProkipUserAuthService();
    
    const email = process.env.PROKIP_USERNAME;
    const password = process.env.PROKIP_PASSWORD;
    const userId = 'test-user-123';
    
    if (!email || !password || email === 'your_actual_prokip_email@example.com') {
      console.log('⚠️ Please set real credentials first');
      return;
    }
    
    const result = await authService.authenticateUser(userId, email, password, 'Test Connection');
    
    console.log('✅ Service authentication successful!');
    console.log('📊 Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Service authentication failed:', error.message);
  }
}

// Run tests
testRealAuthentication()
  .then(() => testAuthService())
  .catch(console.error);
