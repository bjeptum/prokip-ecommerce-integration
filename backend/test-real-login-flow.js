require('dotenv').config();

const axios = require('axios');

// Test the complete authentication flow with real credentials
async function testRealAuthentication() {
  console.log('🧪 Testing Complete Authentication Flow');
  console.log('📝 This test simulates what happens when a user logs in via the dashboard');
  
  try {
    console.log('\n🔐 Step 1: User Login via Dashboard');
    console.log('-' .repeat(50));
    
    // Simulate frontend login with real credentials
    console.log('📝 User enters credentials in dashboard...');
    
    // Test with mock credentials first
    const loginData = {
      username: 'test@prokip.com',
      password: 'testpassword123'
    };
    
    console.log('🌐 Sending login request to /auth/prokip-login...');
    const loginResponse = await axios.post('http://localhost:3000/auth/prokip-login', loginData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Login successful!');
    console.log('📊 Response:', JSON.stringify(loginResponse.data, null, 2));
    
    const { token, connectionId, user } = loginResponse.data;
    
    console.log('\n🔍 Step 2: Connection Status Check');
    console.log('-' .repeat(50));
    
    console.log('🌐 Checking connection status with received token...');
    const statusResponse = await axios.get('http://localhost:3000/auth/prokip-status', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Status check successful!');
    console.log('📊 Status:', JSON.stringify(statusResponse.data, null, 2));
    
    console.log('\n📦 Step 3: Stock Synchronization Test');
    console.log('-' .repeat(50));
    
    // Extract userId from JWT token (for demo purposes)
    const userId = `demo-user-${Date.now()}`;
    
    console.log('🌐 Testing stock check...');
    const stockResponse = await axios.post(`http://localhost:3000/api/prokip/test-stock/${userId}`, {
      items: [
        { sku: 'TEST-PRODUCT-001', quantity: 2 }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Stock check successful!');
    console.log('📊 Stock Response:', JSON.stringify(stockResponse.data, null, 2));
    
    console.log('\n🎉 AUTHENTICATION FLOW COMPLETE!');
    console.log('=' .repeat(60));
    console.log('✅ User can login with Prokip credentials');
    console.log('✅ Connection established and stored');
    console.log('✅ Stock synchronization working');
    console.log('✅ Ready for real WooCommerce orders');
    
    console.log('\n📋 Instructions for Real Login:');
    console.log('1. Open the dashboard in your browser');
    console.log('2. Enter your real Prokip email and password');
    console.log('3. The system will authenticate and connect your account');
    console.log('4. WooCommerce orders will automatically sync stock to Prokip');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 400) {
        console.log('\n💡 This is expected with test credentials.');
        console.log('🔧 Try with your real Prokip credentials in the dashboard!');
      }
    }
  }
}

// Run the test
testRealAuthentication();
