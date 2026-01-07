const axios = require('axios');

async function testCompleteLoginFlow() {
  console.log('🧪 Testing complete login flow...');
  
  try {
    // Test 1: Direct API call (already working)
    console.log('\n1️⃣ Testing direct API call...');
    const apiResponse = await axios.post('http://localhost:3000/auth/login', {
      username: 'admin',
      password: 'changeme123'
    });
    console.log('✅ Direct API call works');
    
    // Test 2: Frontend accessibility
    console.log('\n2️⃣ Testing frontend accessibility...');
    const frontendResponse = await axios.get('http://localhost:3000/');
    console.log('✅ Frontend accessible, status:', frontendResponse.status);
    
    // Test 3: Check if frontend HTML contains login form
    const frontendHtml = frontendResponse.data;
    const hasLoginForm = frontendHtml.includes('id="username"') && frontendHtml.includes('id="password"');
    console.log('✅ Login form present:', hasLoginForm ? '✅ Yes' : '❌ No');
    
    // Test 4: Check if script.js is loaded
    const hasScript = frontendHtml.includes('script.js');
    console.log('✅ Script.js referenced:', hasScript ? '✅ Yes' : '❌ No');
    
    // Test 5: Check if API_BASE_URL is in the script
    if (hasScript) {
      const scriptResponse = await axios.get('http://localhost:3000/script.js');
      const scriptContent = scriptResponse.data;
      const hasApiUrl = scriptContent.includes('API_BASE_URL');
      console.log('✅ API_BASE_URL in script:', hasApiUrl ? '✅ Yes' : '❌ No');
    }
    
    console.log('\n🎉 Complete login flow test completed!');
    console.log('\n📋 Manual Testing Instructions:');
    console.log('1. Open browser and go to: http://localhost:3000');
    console.log('2. Enter username: admin');
    console.log('3. Enter password: changeme123');
    console.log('4. Click "Sign In" button');
    console.log('5. Check browser console for debug messages');
    
    console.log('\n🔧 If login still fails, check:');
    console.log('- Browser console (F12) for JavaScript errors');
    console.log('- Network tab for failed requests');
    console.log('- Make sure you\'re using http://localhost:3000 (not https)');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
    }
  }
}

testCompleteLoginFlow();
