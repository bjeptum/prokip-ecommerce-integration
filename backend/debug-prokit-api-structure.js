require('dotenv').config();

const axios = require('axios');

// Debug Prokip API structure
async function debugProkipApi() {
  console.log('🔍 Debugging Prokip API Structure');
  console.log('🔗 Base URL:', process.env.PROKIP_BASE_URL);
  
  try {
    // First, let's see what's available at the base URL
    console.log('\n🧪 Testing base URL...');
    const baseResponse = await axios.get(process.env.PROKIP_BASE_URL, {
      timeout: 10000
    });
    
    console.log('✅ Base URL accessible');
    console.log('📊 Content-Type:', baseResponse.headers['content-type']);
    console.log('📊 Status:', baseResponse.status);
    
    // Look for login forms or API endpoints in the HTML
    if (typeof baseResponse.data === 'string') {
      const htmlContent = baseResponse.data;
      
      // Look for login forms
      const loginFormMatch = htmlContent.match(/<form[^>]*action=["']([^"']+)["'][^>]*>/i);
      if (loginFormMatch) {
        console.log('✅ Found login form action:', loginFormMatch[1]);
      }
      
      // Look for API endpoints
      const apiMatches = htmlContent.match(/\/api\/[^"'\s>]+/g);
      if (apiMatches) {
        console.log('✅ Found API endpoints:', [...new Set(apiMatches)]);
      }
      
      // Look for login-related routes
      const loginRoutes = htmlContent.match(/\/(login|auth|oauth)[^"'\s>]+/gi);
      if (loginRoutes) {
        console.log('✅ Found login routes:', [...new Set(loginRoutes)]);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

// Run debugging
debugProkipApi().catch(console.error);
