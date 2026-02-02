const axios = require('axios');

// Test exact browser-like login request
async function testExactBrowserLogin() {
  console.log('🔍 TESTING EXACT BROWSER-LIKE LOGIN');
  console.log('=' .repeat(50));
  
  try {
    console.log('🌐 Step 1: Get login page');
    const loginPageResponse = await axios.get('https://api.prokip.africa/login', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    console.log('✅ Login page obtained');
    
    // Extract CSRF token
    const csrfTokenMatch = loginPageResponse.data.match(/name="csrf-token" content="([^"]+)"/);
    if (!csrfTokenMatch) {
      throw new Error('CSRF token not found');
    }
    
    const csrfToken = csrfTokenMatch[1];
    console.log('🔐 CSRF token extracted:', csrfToken.substring(0, 20) + '...');
    
    // Extract cookies from login page
    const cookies = loginPageResponse.headers['set-cookie'] || [];
    const cookieString = cookies.map(cookie => cookie.split(';')[0]).join('; ');
    console.log('🍪 Cookies extracted:', cookieString);
    
    console.log('\n🌐 Step 2: Submit login form');
    
    // Prepare form data exactly as browser would
    const formData = new URLSearchParams();
    formData.append('username', 'kenditrades');
    formData.append('password', 'testpassword');
    formData.append('_token', csrfToken);
    formData.append('remember', 'on'); // Try with remember checked
    
    console.log('📝 Form data prepared:');
    console.log('  - username: kenditrades');
    console.log('  - password: [provided]');
    console.log('  - _token:', csrfToken.substring(0, 20) + '...');
    console.log('  - remember: on');
    
    const loginResponse = await axios.post('https://api.prokip.africa/login', formData, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://api.prokip.africa',
        'Referer': 'https://api.prokip.africa/login',
        'Cookie': cookieString,
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      maxRedirects: 0, // Don't follow redirects automatically
      validateStatus: function (status) {
        return status >= 200 && status < 400; // Accept 2xx and 3xx responses
      }
    });
    
    console.log('✅ Login response status:', loginResponse.status);
    console.log('📊 Response headers:', JSON.stringify(loginResponse.headers, null, 2));
    
    if (loginResponse.status === 302 || loginResponse.status === 307) {
      const location = loginResponse.headers.location;
      console.log('🔄 Redirected to:', location);
      
      if (location.includes('/dashboard') || location.includes('/home')) {
        console.log('🎉 LOGIN SUCCESSFUL!');
      } else {
        console.log('❌ Login failed - unexpected redirect');
      }
    } else {
      console.log('📊 Response body:', loginResponse.data);
    }
    
  } catch (error) {
    console.log('❌ Login test failed:');
    console.log('📊 Status:', error.response?.status);
    console.log('📊 Headers:', JSON.stringify(error.response?.headers, null, 2));
    console.log('📊 Data:', error.response?.data);
    console.log('📊 Message:', error.message);
  }
}

testExactBrowserLogin();
