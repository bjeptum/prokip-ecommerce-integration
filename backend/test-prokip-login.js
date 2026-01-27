// Test Prokip login with mock mode
const axios = require('axios');

async function testProkipLogin() {
  console.log('🧪 Testing Prokip Login with Mock Mode\n');
  
  try {
    const loginData = {
      username: 'kenditrades',
      password: 'test_password', // Any password works in mock mode
      locationId: '21237'
    };
    
    console.log('📋 Login data:');
    console.log(`   Username: ${loginData.username}`);
    console.log(`   Password: ${loginData.password}`);
    console.log(`   Location ID: ${loginData.locationId}`);
    
    console.log('\n🔍 Testing /auth/prokip-login endpoint...');
    
    const response = await axios.post('http://localhost:3000/auth/prokip-login', 
      loginData,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    console.log('✅ Login successful!');
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${JSON.stringify(response.data).substring(0, 300)}...`);
    
    if (response.data.success) {
      console.log('\n🎉 Login Results:');
      console.log(`   Access Token: ${response.data.access_token ? 'Present' : 'Missing'}`);
      console.log(`   Refresh Token: ${response.data.refresh_token ? 'Present' : 'Missing'}`);
      console.log(`   Expires In: ${response.data.expires_in || 'N/A'}`);
      console.log(`   Locations: ${response.data.locations?.length || 0}`);
      
      if (response.data.locations) {
        console.log('\n📍 Available Locations:');
        response.data.locations.forEach((location, index) => {
          console.log(`   ${index + 1}. ${location.name} (ID: ${location.id})`);
        });
      }
    }
    
  } catch (error) {
    console.log('❌ Login failed:');
    console.log(`   Error: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data: ${JSON.stringify(error.response.data).substring(0, 300)}...`);
    }
  }
}

testProkipLogin();
