const axios = require('axios');
require('dotenv').config(); // Load environment variables

/**
 * Test real Prokip API integration
 */
async function testRealProkipAPI() {
  console.log('🧪 Testing Real Prokip API Integration...\n');

  const BASE_URL = process.env.PROKIP_API || 'https://api.prokip.africa';
  console.log('🌐 Using BASE_URL from .env:', BASE_URL);
  
  try {
    // Test 1: Authentication with real API
    console.log('1️⃣ Testing Real Prokip Authentication...');
    console.log('🌐 Base URL:', BASE_URL);
    
    const authResponse = await axios.post(`${BASE_URL}/oauth/token`, 
      new URLSearchParams({
        username: 'kenditrades',
        password: 'Myifrit37942949#',
        desktop_version: '',
        client_id: '6',
        client_secret: 'vkbDU9dKp3iO3h0Yjc3C9sRSmnvBsq5qdtMTEarK',
        grant_type: 'password',
        granttype: 'password',
        scope: ''
      }),
      { 
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000
      }
    );
    
    console.log('✅ Real Prokip Authentication successful!');
    console.log('📦 Token Type:', authResponse.data.token_type);
    console.log('⏰ Expires In:', authResponse.data.expires_in, 'seconds');
    console.log('🔄 Refresh Token:', authResponse.data.refresh_token ? 'Provided' : 'Not provided');
    
    const token = authResponse.data.access_token;
    
    // Test 2: Business Locations
    console.log('\n2️⃣ Testing Real Business Locations...');
    const locationsResponse = await axios.get(`${BASE_URL}/connector/api/business-location`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      timeout: 15000
    });
    
    console.log('✅ Real Business Locations fetched!');
    console.log('📍 Response structure:', Object.keys(locationsResponse.data));
    
    const locations = locationsResponse.data.data || locationsResponse.data || [];
    console.log('📍 Number of locations:', locations.length);
    
    if (locations.length > 0) {
      locations.slice(0, 3).forEach((location, index) => {
        console.log(`   ${index + 1}. ${location.name || location.location_name || 'Unnamed Location'}`);
        if (location.address) console.log(`      📍 ${location.address}`);
        if (location.phone) console.log(`      📞 ${location.phone}`);
      });
    } else {
      console.log('   ℹ️ No locations found or empty response');
    }
    
    // Test 3: Products
    console.log('\n3️⃣ Testing Real Products...');
    const productsResponse = await axios.get(`${BASE_URL}/connector/api/product?per_page=-1`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      timeout: 15000
    });
    
    console.log('✅ Real Products fetched!');
    console.log('📦 Response structure:', Object.keys(productsResponse.data));
    
    const products = productsResponse.data.data || productsResponse.data || [];
    console.log('📦 Number of products:', products.length);
    
    if (products.length > 0) {
      products.slice(0, 3).forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.name || 'Unnamed Product'}`);
        if (product.sku) console.log(`      🏷️ SKU: ${product.sku}`);
        if (product.sell_price || product.price) console.log(`      💰 Price: KES ${product.sell_price || product.price}`);
        if (product.quantity !== undefined) console.log(`      📊 Stock: ${product.quantity}`);
      });
    } else {
      console.log('   ℹ️ No products found or empty response');
    }
    
    console.log('\n🎉 Real Prokip API Integration Test Complete!');
    console.log('\n📋 Test Results:');
    console.log('   ✅ Authentication: Working');
    console.log('   ✅ Business Locations: Working');
    console.log('   ✅ Products: Working');
    console.log('\n🚀 Ready for production use with real Prokip API!');
    
  } catch (error) {
    console.error('❌ Real API Test failed:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.error('🔍 DNS Issue: Cannot resolve', BASE_URL);
      console.error('💡 Solution: Check if the domain is correct or try alternative URLs');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('🔌 Connection Issue: Server is not responding');
      console.error('💡 Solution: Check if the server is running and accessible');
    } else if (error.response) {
      console.error('📄 HTTP Error:', error.response.status, error.response.statusText);
      console.error('📄 Response Data:', error.response.data);
      
      if (error.response.status === 401) {
        console.error('🔐 Authentication failed - Check credentials');
      } else if (error.response.status === 403) {
        console.error('🚫 Access denied - Check permissions');
      } else if (error.response.status === 404) {
        console.error('🔍 Endpoint not found - Check API structure');
      }
    }
    
    console.error('\n🔧 Troubleshooting Tips:');
    console.error('1. Verify the BASE_URL is correct');
    console.error('2. Check your credentials (username/password)');
    console.error('3. Ensure the API endpoints match the documentation');
    console.error('4. Test with curl command first to verify API access');
  }
}

// Run the test
testRealProkipAPI();
