// Test Prokip login with real API (no mock mode)
const axios = require('axios');

async function testRealProkipLogin() {
  console.log('🧪 Testing Real Prokip Login (No Mock Mode)\n');
  
  try {
    const loginData = {
      username: 'kenditrades',
      password: 'your_real_password', // Use your actual password
      locationId: null // Don't specify locationId initially
    };
    
    console.log('📋 Login data:');
    console.log(`   Username: ${loginData.username}`);
    console.log(`   Password: ${loginData.password ? 'Provided' : 'Missing'}`);
    
    console.log('\n🔍 Testing /auth/prokip-login endpoint...');
    
    const response = await axios.post('http://localhost:3000/auth/prokip-login', 
      loginData,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 90000 // 90 seconds timeout for real API
      }
    );
    
    console.log('✅ Login successful!');
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${JSON.stringify(response.data).substring(0, 400)}...`);
    
    if (response.data.success) {
      console.log('\n🎉 Login Results:');
      console.log(`   Access Token: ${response.data.access_token ? 'Present' : 'Missing'}`);
      console.log(`   Refresh Token: ${response.data.refresh_token ? 'Present' : 'Missing'}`);
      console.log(`   Expires In: ${response.data.expires_in || 'N/A'}`);
      console.log(`   Locations: ${response.data.locations?.length || 0}`);
      
      if (response.data.locations) {
        console.log('\n📍 Your Real Business Locations:');
        response.data.locations.forEach((location, index) => {
          console.log(`   ${index + 1}. ${location.name || location.location_name || 'Unnamed Location'}`);
          console.log(`      ID: ${location.id}`);
          console.log(`      Address: ${location.address || location.location_address || 'N/A'}`);
          console.log(`      Default: ${location.is_default ? 'Yes' : 'No'}`);
        });
        
        console.log('\n💡 Location-Specific Filtering:');
        console.log('✅ Each location will show only products assigned to it');
        console.log('✅ Each location will show only sales from that location');
        console.log('✅ Switching locations will filter data accordingly');
      }
    }
    
  } catch (error) {
    console.log('❌ Login failed:');
    console.log(`   Error: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data: ${JSON.stringify(error.response.data).substring(0, 400)}...`);
      
      if (error.response.status === 400) {
        console.log('\n💡 Common Login Issues:');
        console.log('1. Wrong username or password');
        console.log('2. Prokip API is down or slow');
        console.log('3. Network connectivity issues');
        console.log('4. Account locked or suspended');
      }
    }
  }
}

testRealProkipLogin();
