const axios = require('axios');

async function testBusinessLocations() {
  try {
    console.log('🧪 Testing business locations after login...');
    
    // First login to get token
    const loginResponse = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'Myifrit37942949#'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.authResult?.data?.token;
      console.log('✅ Login successful, got token:', token ? 'present' : 'missing');
      console.log('🔍 Token preview:', token ? token.substring(0, 100) + '...' : 'none');
      console.log('🔍 Token type:', typeof token);
      console.log('🔍 Token length:', token ? token.length : 0);
      
      if (token) {
        // Test business locations
        const { ProkipUserAuthService } = require('./src/services/prokipUserAuthService');
        const authService = new ProkipUserAuthService();
        
        const locations = await authService.getBusinessLocations(token);
        console.log('📍 Business locations:', locations);
        console.log('📊 Number of locations:', locations.length);
        
        if (locations.length > 0) {
          console.log('✅ Business locations found!');
          locations.forEach((location, index) => {
            console.log(`  ${index + 1}. ${location.name || location.id} (ID: ${location.id})`);
          });
        } else {
          console.log('⚠️ No business locations found');
        }
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

testBusinessLocations();
