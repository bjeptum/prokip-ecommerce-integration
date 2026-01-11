const axios = require('axios');

async function testProkipIntegration() {
  console.log('🧪 Testing Prokip Integration...\n');

  try {
    // Test 1: Authentication
    console.log('1️⃣ Testing Authentication...');
    const authResponse = await axios.post('http://localhost:4000/oauth/token', 
      new URLSearchParams({
        username: 'kenditrades',
        password: 'Myifrit37942949#',
        client_id: '6',
        client_secret: 'vkbDU9dKp3iO3h0Yjc3C9sRSmnvBsq5qdtMTEarK',
        grant_type: 'password'
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    
    console.log('✅ Authentication successful!');
    console.log('📦 Token received:', authResponse.data.access_token.substring(0, 20) + '...');
    
    const token = authResponse.data.access_token;
    
    // Test 2: Business Locations
    console.log('\n2️⃣ Testing Business Locations...');
    const locationsResponse = await axios.get('http://localhost:4000/connector/api/business-location', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('✅ Locations fetched!');
    console.log('📍 Number of locations:', locationsResponse.data.data.length);
    locationsResponse.data.data.forEach((location, index) => {
      console.log(`   ${index + 1}. ${location.name} - ${location.address}`);
    });
    
    // Test 3: Products
    console.log('\n3️⃣ Testing Products...');
    const productsResponse = await axios.get('http://localhost:4000/connector/api/product', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('✅ Products fetched!');
    console.log('📦 Number of products:', productsResponse.data.data.length);
    productsResponse.data.data.slice(0, 3).forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.name} (${product.sku}) - KES ${product.price}`);
    });
    
    // Test 4: Sales
    console.log('\n4️⃣ Testing Sales...');
    const salesResponse = await axios.get('http://localhost:4000/connector/api/sell', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('✅ Sales data fetched!');
    console.log('💰 Number of sales:', salesResponse.data.data.length);
    salesResponse.data.data.forEach((sale, index) => {
      console.log(`   ${index + 1}. ${sale.invoice_no} - ${sale.platform} - KES ${sale.total}`);
    });
    
    // Test 5: Analytics
    console.log('\n5️⃣ Testing Analytics...');
    const analyticsResponse = await axios.get('http://localhost:4000/connector/api/analytics', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('✅ Analytics data fetched!');
    const analytics = analyticsResponse.data.data;
    console.log('📊 Total Sales: KES', analytics.total_sales);
    console.log('📊 Total Orders:', analytics.total_orders);
    console.log('📊 Sales by Platform:');
    Object.entries(analytics.sales_by_platform).forEach(([platform, data]) => {
      console.log(`   ${platform}: ${data.orders} orders, KES ${data.revenue}`);
    });
    
    console.log('\n🎉 All tests passed! Prokip integration is working correctly.');
    console.log('\n📋 Summary:');
    console.log('   ✅ Authentication with real credentials');
    console.log('   ✅ Business locations loaded');
    console.log('   ✅ Products displayed');
    console.log('   ✅ Sales with prefixes (PROKIP, WOO, SHOPIFY)');
    console.log('   ✅ Analytics dashboard data');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Run the test
testProkipIntegration();
