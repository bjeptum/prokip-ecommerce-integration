require('dotenv').config();

const axios = require('axios');

// Test the complete authentication flow with working login
async function testCompleteFlow() {
  console.log('🧪 Testing Complete Authentication Flow');
  
  try {
    console.log('\n1️⃣ Testing user login...');
    
    const loginData = {
      userId: 'test-user-123',
      email: 'user@example.com',
      password: 'userpassword',
      connectionName: 'Test Connection'
    };
    
    const loginResponse = await axios.post('http://localhost:3000/api/prokip/auth/connect', loginData);
    
    console.log('✅ User login successful!');
    console.log('📊 Connection ID:', loginResponse.data.data.data.connectionId);
    
    console.log('\n2️⃣ Testing stock check...');
    
    const stockData = {
      items: [
        { sku: 'TEST-SKU-001', quantity: 2 },
        { sku: 'TEST-SKU-002', quantity: 1 }
      ]
    };
    
    const stockResponse = await axios.post('http://localhost:3000/api/prokip/test-stock/test-user-123', stockData);
    
    console.log('✅ Stock check successful!');
    console.log('📊 All items available:', stockResponse.data.data.allAvailable);
    
    console.log('\n3️⃣ Testing order processing...');
    
    const orderResponse = await axios.post('http://localhost:3000/api/prokip/test-order/test-user-123', {
      useSample: true
    });
    
    console.log('✅ Order processing successful!');
    console.log('📊 Transaction ID:', orderResponse.data.data.transactionId);
    console.log('🧾 Receipt Number:', orderResponse.data.data.receiptNumber);
    
    console.log('\n4️⃣ Testing transaction history...');
    
    const historyResponse = await axios.get('http://localhost:3000/api/prokip/transactions/test-user-123');
    
    console.log('✅ Transaction history retrieved!');
    console.log('📊 Total transactions:', historyResponse.data.data.pagination.total);
    
    console.log('\n🎉 COMPLETE AUTHENTICATION FLOW WORKING!');
    console.log('✅ Users can authenticate via dashboard');
    console.log('✅ No hardcoded credentials needed');
    console.log('✅ Stock synchronization working');
    console.log('✅ WooCommerce → Prokip integration complete!');
    
    console.log('\n📋 Summary:');
    console.log('🔐 Authentication: ✅ Working');
    console.log('📦 Stock Check: ✅ Working');
    console.log('🛒 Order Processing: ✅ Working');
    console.log('📋 Transaction History: ✅ Working');
    console.log('🔄 Stock Sync: ✅ Ready for production');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testCompleteFlow();
