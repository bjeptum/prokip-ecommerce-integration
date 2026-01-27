// WooCommerce Connection Diagnostic Tool
const axios = require('axios');

async function diagnoseWooCommerceConnection() {
  console.log('🔍 WooCommerce Connection Diagnostic Tool\n');
  
  const storeUrl = 'https://prowebfunnels.com/kenditrades/';
  console.log(`📍 Testing store: ${storeUrl}\n`);
  
  // Test 1: Basic connectivity
  console.log('1. Testing basic connectivity...');
  try {
    const response = await axios.get(storeUrl, { timeout: 10000 });
    console.log('✅ Store is accessible');
    console.log(`   Status: ${response.status}`);
    console.log(`   Content-Type: ${response.headers['content-type']}`);
  } catch (error) {
    console.log('❌ Store not accessible:', error.message);
    return;
  }
  
  // Test 2: Check if WooCommerce is installed
  console.log('\n2. Checking WooCommerce installation...');
  try {
    const wooTestUrl = `${storeUrl}wp-json/wc/v3/`;
    const response = await axios.get(wooTestUrl, { 
      timeout: 10000,
      validateStatus: () => true // Accept any status to see what we get
    });
    console.log(`✅ WooCommerce API endpoint responded`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${JSON.stringify(response.data).substring(0, 200)}...`);
    
    if (response.status === 200 && response.data.namespace === 'wc/v3') {
      console.log('✅ WooCommerce API is properly configured');
    } else {
      console.log('❌ WooCommerce API not properly configured');
      console.log('💡 Possible issues:');
      console.log('   - WooCommerce REST API disabled');
      console.log('   - WooCommerce not installed');
      console.log('   - Permalinks not set to "Post name"');
    }
  } catch (error) {
    console.log('❌ WooCommerce API not accessible:', error.message);
    console.log('💡 Required WordPress settings:');
    console.log('   1. WooCommerce → Settings → Advanced → Legacy API: Enable REST API');
    console.log('   2. Settings → Permalinks: Select "Post name"');
    console.log('   3. Check security plugins for API blocking');
  }
  
  // Test 3: Check with sample credentials
  console.log('\n3. Testing with sample credentials...');
  try {
    const testUrl = `${storeUrl}wp-json/wc/v3/products?per_page=1`;
    const response = await axios.get(testUrl, {
      auth: {
        username: 'ck_test_key',
        password: 'cs_test_secret'
      },
      headers: {
        'User-Agent': 'Prokip-Integration/1.0',
        'Accept': 'application/json'
      },
      timeout: 10000,
      validateStatus: () => true
    });
    
    console.log(`✅ API call successful`);
    console.log(`   Status: ${response.status}`);
    if (response.status === 401) {
      console.log('❌ Invalid credentials (expected with test keys)');
    }
  } catch (error) {
    console.log('❌ API call failed:', error.message);
  }
  
  console.log('\n🔧 SOLUTION STEPS:');
  console.log('1. Go to your WordPress admin: https://prowebfunnels.com/kenditrades/wp-admin/');
  console.log('2. WooCommerce → Settings → Advanced → Legacy API:');
  console.log('   - Enable "Legacy REST API"');
  console.log('3. Settings → Permalinks:');
  console.log('   - Select "Post name" structure');
  console.log('4. WooCommerce → Settings → Advanced → REST API:');
  console.log('   - Generate new Consumer Key & Secret');
  console.log('5. Use those credentials to connect');
  console.log('6. Check security plugins for API blocking');
  
  console.log('\n📋 Alternative: Use Application Password');
  console.log('If Consumer Key/Secret fails, try:');
  console.log('1. Users → Profile → Application Passwords');
  console.log('2. Create new Application Password');
  console.log('3. Use WordPress username + Application Password');
}

diagnoseWooCommerceConnection();
