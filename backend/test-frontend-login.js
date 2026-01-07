const axios = require('axios');

async function testFrontendLogin() {
  try {
    console.log('🧪 Testing frontend login simulation...');
    
    // Test the exact same request the frontend would make
    const response = await axios.post('http://localhost:3000/auth/login', {
      username: 'admin',
      password: 'changeme123'  // Your correct password from .env.example
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',  // Simulate browser request
        'Referer': 'http://localhost:3000/'
      }
    });

    console.log('✅ Frontend login simulation successful!');
    console.log('Status:', response.status);
    console.log('Token received:', response.data.token ? '✅ Yes' : '❌ No');
    console.log('Token length:', response.data.token ? response.data.token.length : 0);
    
    // Test a protected route with the token
    const protectedResponse = await axios.get('http://localhost:3000/connections/status', {
      headers: {
        'Authorization': `Bearer ${response.data.token}`
      }
    });
    
    console.log('✅ Protected route access successful!');
    console.log('Connections found:', protectedResponse.data.length);
    
  } catch (error) {
    console.error('❌ Frontend login test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    } else {
      console.error('Network error:', error.message);
    }
  }
}

testFrontendLogin();
