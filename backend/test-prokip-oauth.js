const axios = require('axios');

// Test the actual Prokip OAuth endpoint
async function testProkipOAuth() {
  console.log('🔍 TESTING PROKIP OAUTH ENDPOINT');
  console.log('=' .repeat(50));
  
  console.log('🧪 Test 1: OAuth with JSON payload');
  console.log('-' .repeat(30));
  
  try {
    const response = await axios.post('https://api.prokip.africa/oauth/token', {
      grant_type: 'password',
      client_id: '6',
      client_secret: 'vkbDU9dKp3iO3h0Yjc3C9sRSmnvBsq5qdtMTEarK',
      username: 'kenditrades',
      password: 'testpassword'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ OAuth JSON Success:', response.status);
    console.log('📊 Response:', response.data);
    
  } catch (error) {
    console.log('❌ OAuth JSON Error:');
    console.log('📊 Status:', error.response?.status);
    console.log('📊 Data:', error.response?.data);
    console.log('📊 Message:', error.message);
  }
  
  console.log('\n🧪 Test 2: OAuth with form payload');
  console.log('-' .repeat(30));
  
  try {
    const formData = new URLSearchParams();
    formData.append('grant_type', 'password');
    formData.append('client_id', '6');
    formData.append('client_secret', 'vkbDU9dKp3iO3h0Yjc3C9sRSmnvBsq5qdtMTEarK');
    formData.append('username', 'kenditrades');
    formData.append('password', 'testpassword');
    
    const response = await axios.post('https://api.prokip.africa/oauth/token', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('✅ OAuth Form Success:', response.status);
    console.log('📊 Response:', response.data);
    
  } catch (error) {
    console.log('❌ OAuth Form Error:');
    console.log('📊 Status:', error.response?.status);
    console.log('📊 Data:', error.response?.data);
    console.log('📊 Message:', error.message);
  }
  
  console.log('\n🧪 Test 3: Try alternative endpoints');
  console.log('-' .repeat(30));
  
  const endpoints = [
    '/api/v1/login',
    '/api/login', 
    '/login',
    '/oauth/token',
    '/connector/api/login'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios.post(`https://api.prokip.africa${endpoint}`, {
        username: 'kenditrades',
        password: 'testpassword'
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`✅ ${endpoint} Success:`, response.status);
      console.log('📊 Response:', response.data);
      break;
      
    } catch (error) {
      console.log(`❌ ${endpoint} Error:`, error.response?.status);
      if (error.response?.status !== 404 && error.response?.status !== 401) {
        console.log('📊 Data:', error.response?.data);
      }
    }
  }
}

testProkipOAuth();
