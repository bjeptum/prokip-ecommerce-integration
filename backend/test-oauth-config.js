const axios = require('axios');

// Test different OAuth configurations
async function testOAuthConfigurations() {
  console.log('🔍 TESTING OAUTH CONFIGURATIONS');
  console.log('=' .repeat(50));
  
  console.log('🧪 Test 1: Try different grant_types');
  console.log('-' .repeat(30));
  
  const grantTypes = ['password', 'client_credentials', 'authorization_code'];
  
  for (const grantType of grantTypes) {
    try {
      const formData = new URLSearchParams();
      formData.append('grant_type', grantType);
      formData.append('client_id', '6');
      formData.append('client_secret', 'vkbDU9dKp3iO3h0Yjc3C9sRSmnvBsq5qdtMTEarK');
      if (grantType === 'password') {
        formData.append('username', 'kenditrades');
        formData.append('password', 'testpassword');
      }
      
      const response = await axios.post('https://api.prokip.africa/oauth/token', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      console.log(`✅ Grant type ${grantType} Success:`, response.status);
      console.log('📊 Response:', response.data);
      break;
      
    } catch (error) {
      console.log(`❌ Grant type ${grantType} Error:`, error.response?.status);
      if (error.response?.status !== 400) {
        console.log('📊 Data:', error.response?.data);
      }
    }
  }
  
  console.log('\n🧪 Test 2: Try with additional parameters');
  console.log('-' .repeat(30));
  
  try {
    const formData = new URLSearchParams();
    formData.append('grant_type', 'password');
    formData.append('client_id', '6');
    formData.append('client_secret', 'vkbDU9dKp3iO3h0Yjc3C9sRSmnvBsq5qdtMTEarK');
    formData.append('username', 'kenditrades');
    formData.append('password', 'testpassword');
    formData.append('scope', '');
    formData.append('desktop_version', '');
    
    const response = await axios.post('https://api.prokip.africa/oauth/token', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('✅ Extended OAuth Success:', response.status);
    console.log('📊 Response:', response.data);
    
  } catch (error) {
    console.log('❌ Extended OAuth Error:');
    console.log('📊 Status:', error.response?.status);
    console.log('📊 Data:', error.response?.data);
  }
  
  console.log('\n🧪 Test 3: Try /login endpoint with CSRF');
  console.log('-' .repeat(30));
  
  try {
    // First get the login page to get CSRF token
    const loginPage = await axios.get('https://api.prokip.africa/login');
    console.log('📄 Login page status:', loginPage.status);
    
    // Try to extract CSRF token if present
    const csrfMatch = loginPage.data.match(/name="_token" content="([^"]+)"/);
    if (csrfMatch) {
      const csrfToken = csrfMatch[1];
      console.log('🔐 Found CSRF token:', csrfToken.substring(0, 20) + '...');
      
      // Try login with CSRF
      const formData = new URLSearchParams();
      formData.append('username', 'kenditrades');
      formData.append('password', 'testpassword');
      formData.append('_token', csrfToken);
      
      const response = await axios.post('https://api.prokip.africa/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      console.log('✅ Login with CSRF Success:', response.status);
      console.log('📊 Response:', response.data);
    }
    
  } catch (error) {
    console.log('❌ Login with CSRF Error:');
    console.log('📊 Status:', error.response?.status);
    console.log('📊 Data:', error.response?.data);
  }
}

testOAuthConfigurations();
