// Test WooCommerce connection with current Prokip token
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

async function testWithCurrentToken() {
  console.log('🧪 Testing with Current Prokip Token\n');
  
  try {
    const prisma = new PrismaClient();
    
    // Get current Prokip token
    const prokipConfig = await prisma.prokipConfig.findFirst();
    if (!prokipConfig || !prokipConfig.token) {
      console.log('❌ No Prokip token found');
      return;
    }
    
    const token = prokipConfig.token;
    console.log(`✅ Using current Prokip token (length: ${token.length})`);
    
    // Test WooCommerce connection endpoint
    console.log('\n🔍 Testing /woo-connections/connect endpoint...');
    
    const testData = {
      storeUrl: 'https://prowebfunnels.com/kenditrades/',
      consumerKey: 'ck_your_real_key', // Replace with your real key
      consumerSecret: 'cs_your_real_secret' // Replace with your real secret
    };
    
    try {
      const response = await axios.post('http://localhost:3000/woo-connections/connect', 
        testData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ Connection endpoint successful!');
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(response.data).substring(0, 300)}...`);
      
    } catch (error) {
      console.log('❌ Connection endpoint failed:');
      console.log(`   Error: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Data: ${JSON.stringify(error.response.data).substring(0, 300)}...`);
        
        // If it's a validation error, show what's expected
        if (error.response.status === 400) {
          console.log('\n💡 This is likely a validation error. Expected format:');
          console.log('   storeUrl: "https://prowebfunnels.com/kenditrades/"');
          console.log('   consumerKey: "ck_xxxxxxxxxxxx"');
          console.log('   consumerSecret: "cs_xxxxxxxxxxxx"');
        }
      }
    }
    
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testWithCurrentToken();
