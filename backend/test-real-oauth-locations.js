const axios = require('axios');

async function testRealBusinessLocations() {
  try {
    console.log('🧪 Testing real OAuth authentication and business locations...');
    
    // Test login with OAuth
    const loginResponse = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'Myifrit37942949#'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (loginResponse.data.success) {
      console.log('✅ OAuth Login successful!');
      console.log('📦 Full response:', JSON.stringify(loginResponse.data, null, 2));
      console.log('📦 Access token:', loginResponse.data.access_token ? 'present' : 'missing');
      console.log('📍 Business locations:', loginResponse.data.locations?.length || 0);
      
      if (loginResponse.data.locations && loginResponse.data.locations.length > 0) {
        console.log('✅ Real business locations found!');
        loginResponse.data.locations.forEach((location, index) => {
          console.log(`  ${index + 1}. ${location.name || location.id} (ID: ${location.id})`);
        });
      } else {
        console.log('⚠️ No business locations returned');
      }
    } else {
      console.log('❌ Login failed:', loginResponse.data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('📊 Status:', error.response.status);
      console.error('📦 Data:', error.response.data);
    }
  }
}

testRealBusinessLocations();
