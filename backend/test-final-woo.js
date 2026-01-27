// Test WooCommerce connection with current token and real credentials
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

async function testWithCurrentToken() {
  console.log('🧪 Testing WooCommerce Connection with Current Token\n');
  
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
    
    // Test with placeholder - user will replace with real credentials
    const testData = {
      storeUrl: 'https://prowebfunnels.com/kenditrades/',
      consumerKey: 'ck_your_real_consumer_key', // REPLACE WITH YOUR REAL KEY
      consumerSecret: 'cs_your_real_consumer_secret' // REPLACE WITH YOUR REAL SECRET
    };
    
    console.log('\n📋 Ready to test with your real credentials:');
    console.log(`   Store URL: ${testData.storeUrl}`);
    console.log(`   Consumer Key: ${testData.consumerKey}`);
    console.log(`   Consumer Secret: ${testData.consumerSecret.substring(0, 10)}...`);
    
    console.log('\n🔍 Testing backend connection endpoint...');
    
    try {
      const response = await axios.post('http://localhost:3000/woo-connections/connect', 
        testData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      
      console.log('✅ Connection successful!');
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(response.data).substring(0, 300)}...`);
      
    } catch (error) {
      console.log('❌ Connection failed:');
      console.log(`   Error: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Data: ${JSON.stringify(error.response.data).substring(0, 300)}...`);
        
        if (error.response.status === 400) {
          const errorData = error.response.data;
          if (errorData.error === 'CONNECTION_REFUSED') {
            console.log('\n🔧 CONNECTION_REFUSED - Complete Fix:');
            console.log('1. Go to your WordPress admin:');
            console.log('   https://prowebfunnels.com/kenditrades/wp-admin/');
            console.log('2. WooCommerce → Settings → Advanced → Legacy API:');
            console.log('   ✅ Enable "Legacy REST API"');
            console.log('3. WooCommerce → Settings → Advanced → REST API:');
            console.log('   📋 Create new Consumer Key/Secret');
            console.log('   🔑 Permissions: Read/Write');
            console.log('4. Security Plugins:');
            console.log('   🛡️ Temporarily disable Wordfence/Sucuri');
            console.log('5. Try connection again');
          }
        }
      }
    }
    
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testWithCurrentToken();
