// Test WooCommerce connection with real credentials
const axios = require('axios');

async function testWooConnection() {
  console.log('🧪 Testing WooCommerce Connection (Real Mode)\n');
  
  try {
    // Test with your actual credentials format
    const testData = {
      storeUrl: 'https://prowebfunnels.com/kenditrades/',
      consumerKey: 'ck_your_actual_consumer_key_here',
      consumerSecret: 'cs_your_actual_consumer_secret_here'
    };
    
    console.log('📋 Connection Test Data:');
    console.log(`   Store URL: ${testData.storeUrl}`);
    console.log(`   Consumer Key: ${testData.consumerKey}`);
    console.log(`   Consumer Secret: ${testData.consumerSecret.substring(0, 10)}...`);
    
    console.log('\n🔍 Testing WooCommerce API directly...');
    
    // Test 1: Direct WooCommerce API test
    try {
      const apiTestUrl = `${testData.storeUrl}wp-json/wc/v3/`;
      const response = await axios.get(apiTestUrl, {
        timeout: 10000,
        validateStatus: () => true // Accept any status to see what we get
      });
      
      console.log(`✅ WooCommerce API accessible: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(response.data).substring(0, 200)}...`);
      
    } catch (error) {
      console.log(`❌ WooCommerce API failed: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Data: ${JSON.stringify(error.response.data).substring(0, 200)}...`);
      }
    }
    
    console.log('\n🔍 Testing backend connection endpoint...');
    
    // Test 2: Backend connection endpoint
    try {
      const response = await axios.post('http://localhost:3000/woo-connections/connect', 
        testData,
        {
          headers: {
            'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImE0ZWFkOWEyNjM2NzRmOGE5NjRmMDNmZjU0ODIxYTZlZWNhYmUzYmU0YWVmOWEzMTZlMTFjMzIzMzZjZmNkNjJhNGIwN2Y1OTIzOTYzMGQ2In0.eyJhdWQiOiI2IiwianRpIjoiYTRlYWQ5YTI2MzY3NGY4YTk2NGYwM2ZmNTQ4MjFhNmVlY2FiZTNiZTRhZWY5YTMxNmUxMWMzMjMzNmNmY2Q2MmE0YjA3ZjU5MjM5NjMwZDYiLCJpYXQiOjE3NjgxNjQ3ODYsIm5iZiI6MTc2ODE2NDc4NiwiaWF0IjoxNzY4MTY0Nzg2LCJleHAiOjE3OTk3MDA3ODYsInN1YiI6IjQ0ODgxIiwic2NvcGVzIjpbXX0.Ur9NfAAwVOdDziUtsbGOfH4vmCRMSTGTzoXKgJUY31XdFTME96psqWFtlTIHFW9s5tlFK6b-XhlEtqV1W0yNOvmpIFNJy_cdI3xqYGm-rB_Iiytklu7fMQClEXqpGvIOrTknRY-BEfjwL3pWnYxkBcdWMcUF_XlIfuNPaZkNKVbnFsmKNDlMX9nHPSMZ0x-O062GVTqsg6d_jr2tq1J7s3wnBautOINxyMdnGFdQDfrnMbYYtlQsDT99qpffKtgw8hGL293PBHAq-Q5GzGeU7K8n0-ka9D-Q6hiPrwNG1Yn1e8qpUiB8qwIJeRNFwV0blcCVk1Z_TyIFy9J0VW-PLU0nm2cwJWM4QiFVtSdTdoJ1KC3_Py7ToGp_k133NGi4G95uyUu_C03wc78cKKOVUCP-5voTeL3HQr8aQkhqyMQfrO0RG6rJmIw9vhMZVsT3qCYDtPUHvWWd6tFAuEsUB9nFuvqbNkLW6Uuaw53UnM-9ZZvXCynKtFt3S1PSoJyYNKvvCTUnXdaI6ihdM65FDrjRZW7O_GxDBHzoXtiuSVPKXG-d7lEjApZUNChweSrbkRsiVm9s3dsvqRX_Vv4c7kEBgPwhugN53U5Jg0bJRexqkGULvHizJCvZtkegneMsDks6UKB63X23wtvcCrgJyfGDIR7_6pqRlP2Az7Xuf7I',
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      
      console.log('✅ Backend connection successful!');
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(response.data).substring(0, 400)}...`);
      
    } catch (error) {
      console.log('❌ Backend connection failed:');
      console.log(`   Error: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Data: ${JSON.stringify(error.response.data).substring(0, 400)}...`);
        
        // Provide specific guidance based on error
        if (error.response.status === 400) {
          const errorData = error.response.data;
          if (errorData.error === 'CONNECTION_REFUSED') {
            console.log('\n💡 CONNECTION_REFUSED - Solutions:');
            console.log('   1. Check if WooCommerce REST API is enabled');
            console.log('   2. Verify Consumer Key has Read/Write permissions');
            console.log('   3. Disable security plugins temporarily');
            console.log('   4. Check firewall/hosting blocking');
            console.log('   5. Ensure store URL is correct');
          }
        }
      }
    }
    
    console.log('\n📋 Next Steps:');
    console.log('1. Replace test credentials with your REAL Consumer Key & Secret');
    console.log('2. Go to frontend and try connecting');
    console.log('3. If still fails, check WooCommerce settings');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testWooConnection();
