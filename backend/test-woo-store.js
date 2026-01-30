const axios = require('axios');

async function testWooCommerceStore() {
  console.log('🌐 Testing WooCommerce Store Access');
  console.log('===================================');

  try {
    // 1. Test basic store accessibility
    console.log('\n1️⃣ Testing store URL accessibility...');
    const storeUrl = 'https://prowebfunnels.com/kenditrades';
    
    try {
      const response = await axios.get(storeUrl, {
        timeout: 10000,
        validateStatus: (status) => status < 500
      });
      console.log(`✅ Store accessible (Status: ${response.status})`);
      
      // Check if it's a WordPress/WooCommerce site
      const html = response.data;
      if (html.includes('woocommerce') || html.includes('WooCommerce')) {
        console.log('✅ WooCommerce detected on the site');
      } else {
        console.log('⚠️ WooCommerce not detected - check if this is the correct store URL');
      }
    } catch (error) {
      console.error('❌ Store not accessible:', error.message);
      console.log('   This could mean:');
      console.log('   - Store URL is incorrect');
      console.log('   - Store is down');
      console.log('   - Network connectivity issues');
      return;
    }

    // 2. Test WooCommerce API endpoint
    console.log('\n2️⃣ Testing WooCommerce API endpoint...');
    const apiUrl = 'https://prowebfunnels.com/kenditrades/wp-json/wc/v3/';
    
    try {
      const response = await axios.get(apiUrl, {
        timeout: 10000,
        validateStatus: (status) => status < 500
      });
      console.log(`✅ WooCommerce API accessible (Status: ${response.status})`);
    } catch (error) {
      console.error('❌ WooCommerce API not accessible:', error.message);
      console.log('   This could mean:');
      console.log('   - WooCommerce REST API is disabled');
      console.log('   - Permalinks are not configured correctly');
      console.log('   - API endpoint is blocked');
    }

    // 3. Test API authentication
    console.log('\n3️⃣ Testing API authentication...');
    const consumerKey = 'ck_62f757841636975ebf322465ab45a324658a4e4b';
    const consumerSecret = 'cs_1417fdf5283158b5dcd7013a86e518afb3f5d080';
    
    const client = axios.create({
      baseURL: apiUrl,
      auth: {
        username: consumerKey,
        password: consumerSecret
      },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Prokip-Integration/1.0'
      },
      timeout: 15000
    });

    try {
      const response = await client.get('system_status', {
        timeout: 10000
      });
      console.log('✅ API authentication successful!');
      console.log(`   WooCommerce Version: ${response.data.data?.woocommerce_version || 'Unknown'}`);
      
      // Test webhook creation
      console.log('\n4️⃣ Testing webhook creation...');
      const webhookUrl = 'https://nonluminous-flawed-lonny.ngrok-free.dev/connections/webhook/woocommerce';
      
      const testWebhook = {
        name: 'Prokip Test Webhook',
        topic: 'order.created',
        delivery_url: webhookUrl,
        secret: 'prokip_secret',
        status: 'active'
      };

      const webhookResponse = await client.post('webhooks', testWebhook);
      console.log('✅ Webhook creation successful!');
      console.log(`   Webhook ID: ${webhookResponse.data.id}`);
      
      // Clean up test webhook
      await client.delete(`webhooks/${webhookResponse.data.id}`);
      console.log('✅ Test webhook cleaned up');
      
      console.log('\n🎉 EVERYTHING IS WORKING!');
      console.log('\n📋 STATUS:');
      console.log('✅ Store URL: https://prowebfunnels.com/kenditrades');
      console.log('✅ API Endpoint: /wp-json/wc/v3/');
      console.log('✅ Authentication: Consumer Key/Secret');
      console.log('✅ Webhook URL: https://nonluminous-flawed-lonny.ngrok-free.dev/connections/webhook/woocommerce');
      
      console.log('\n🎯 READY FOR TESTING:');
      console.log('1. Create a new "completed" order in WooCommerce');
      console.log('2. Watch your server logs for webhook processing');
      console.log('3. Verify stock reduction in Prokip');
      
    } catch (error) {
      console.error('❌ API authentication failed:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        console.log('\n🔧 AUTHENTICATION ISSUE:');
        console.log('The Consumer Key/Secret are not working.');
        console.log('\nCHECK:');
        console.log('1. Consumer Key: ck_62f757841636975ebf322465ab45a324658a4e4b');
        console.log('2. Consumer Secret: cs_1417fdf5283158b5dcd7013a86e518afb3f5d080');
        console.log('3. Permissions: Must be "Read/Write"');
        console.log('4. User: Must have admin privileges');
        
        console.log('\n🔧 TO FIX:');
        console.log('1. Go to WooCommerce > Settings > Advanced > REST API');
        console.log('2. Find your Consumer Key');
        console.log('3. Verify permissions are "Read/Write"');
        console.log('4. If needed, regenerate the keys');
        console.log('5. Update the credentials');
      } else if (error.code === 'ECONNABORTED') {
        console.log('\n🔧 TIMEOUT ISSUE:');
        console.log('The API request is timing out.');
        console.log('This could be due to:');
        console.log('- Slow server response');
        console.log('- Network connectivity issues');
        console.log('- Server overload');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run test
testWooCommerceStore();
