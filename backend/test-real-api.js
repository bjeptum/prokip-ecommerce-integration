require('dotenv').config();

const axios = require('axios');

// Test real Prokip authentication
async function testRealProkipAuth() {
  console.log('🧪 Testing Real Prokip Authentication');
  console.log('📝 MOCK_PROKIP:', process.env.MOCK_PROKIP);
  console.log('🔗 PROKIP_BASE_URL:', process.env.PROKIP_BASE_URL);
  
  try {
    console.log('\n🔐 Testing with real Prokip API...');
    
    // Test with the actual credentials from the logs
    const loginData = {
      username: 'kenditrades',
      password: 'your-actual-password' // User needs to replace this
    };
    
    console.log('📝 Testing login with:', loginData.username);
    
    const response = await axios.post('http://localhost:3000/auth/prokip-login', loginData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Login successful!');
    console.log('📊 Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 400) {
        console.log('\n💡 This could mean:');
        console.log('1. Invalid credentials (most likely)');
        console.log('2. Prokip API endpoint issues');
        console.log('3. Network connectivity problems');
        
        console.log('\n🔍 Let me test the Prokip API directly...');
        await testProkipApiDirectly();
      }
    }
  }
}

// Test Prokip API directly
async function testProkipApiDirectly() {
  console.log('\n🔍 Testing Prokip API directly...');
  
  try {
    const axios = require('axios');
    
    // Test different login endpoints
    const endpoints = [
      '/api/v1/login',
      '/api/login',
      '/login'
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`\n🧪 Testing endpoint: ${endpoint}`);
        
        const response = await axios.post(`${process.env.PROKIP_BASE_URL}${endpoint}`, {
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
        
        console.log(`✅ ${endpoint} - Status: ${response.status}`);
        console.log('📊 Response:', JSON.stringify(response.data, null, 2));
        
      } catch (error) {
        if (error.response) {
          console.log(`❌ ${endpoint} - Status: ${error.response.status}`);
          if (error.response.status === 401 || error.response.status === 422) {
            console.log(`✅ ${endpoint} exists (just needs valid credentials)`);
          }
        } else {
          console.log(`❌ ${endpoint} - Network error: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
}

// Run the test
testRealProkipAuth();
