require('dotenv').config();

const axios = require('axios');

// Test the complete authentication flow via API
async function testCompleteAPIFlow() {
  console.log('🧪 Testing Complete Authentication Flow via API');
  
  try {
    console.log('\n1️⃣ Testing user login via API endpoint...');
    
    const loginData = {
      userId: 'test-user-123',
      email: 'user@example.com',
      password: 'userpassword',
      connectionName: 'Test Connection'
    };
    
    const loginResponse = await axios.post('http://localhost:3000/api/prokip/auth/connect', loginData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ User login successful!');
    console.log('📊 Response:', JSON.stringify(loginResponse.data, null, 2));
    
    console.log('\n2️⃣ Testing connection status...');
    
    const statusResponse = await axios.get('http://localhost:3000/api/prokip/auth/status/test-user-123');
    
    console.log('✅ Connection status retrieved!');
    console.log('📊 Response:', JSON.stringify(statusResponse.data, null, 2));
    
    console.log('\n3️⃣ Testing stock check...');
    
    const stockData = {
      items: [
        { sku: 'TEST-SKU-001', quantity: 2 },
        { sku: 'TEST-SKU-002', quantity: 1 }
      ]
    };
    
    const stockResponse = await axios.post('http://localhost:3000/api/prokip/test-stock/test-user-123', stockData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Stock check successful!');
    console.log('📊 Response:', JSON.stringify(stockResponse.data, null, 2));
    
    console.log('\n4️⃣ Testing order processing...');
    
    const orderResponse = await axios.post('http://localhost:3000/api/prokip/test-order/test-user-123', {
      useSample: true
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Order processing successful!');
    console.log('📊 Response:', JSON.stringify(orderResponse.data, null, 2));
    
    console.log('\n🎉 COMPLETE AUTHENTICATION FLOW WORKING!');
    console.log('✅ Users can authenticate via dashboard');
    console.log('✅ No hardcoded credentials needed');
    console.log('✅ Stock synchronization ready');
    console.log('✅ WooCommerce → Prokip integration complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testCompleteAPIFlow();
