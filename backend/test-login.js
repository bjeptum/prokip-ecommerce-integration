const axios = require('axios');

async function testLogin() {
  try {
    console.log('Testing login with demo credentials...');
    
    const response = await axios.post('http://localhost:3000/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    console.log('✅ Login successful!');
    console.log('Token:', response.data.token);
    
    // Test protected route
    const authResponse = await axios.get('http://localhost:3000/connections/status', {
      headers: {
        'Authorization': `Bearer ${response.data.token}`
      }
    });
    
    console.log('✅ Protected route access successful!');
    console.log('Connections:', authResponse.data);
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testLogin();
