const axios = require('axios');

// Analyze Prokip login page structure
async function analyzeProkipLoginPage() {
  console.log('🔍 ANALYZING PROKIP LOGIN PAGE');
  console.log('=' .repeat(50));
  
  try {
    console.log('🌐 Fetching login page...');
    const response = await axios.get('https://api.prokip.africa/login', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log('✅ Login page fetched:', response.status);
    
    // Extract CSRF token
    const csrfTokenMatch = response.data.match(/name="csrf-token" content="([^"]+)"/);
    if (csrfTokenMatch) {
      console.log('🔐 CSRF token found:', csrfTokenMatch[1].substring(0, 20) + '...');
    } else {
      console.log('❌ CSRF token not found with csrf-token pattern');
    }
    
    // Look for other CSRF patterns
    const csrfPatterns = [
      /name="_token" content="([^"]+)"/,
      /name="csrf-token" content="([^"]+)"/,
      /name="_token" value="([^"]+)"/,
      /name="csrf_token" value="([^"]+)"/,
      /<input[^>]*name=["\']_token["\'][^>]*value=["\']([^"\']+)["\']/
    ];
    
    console.log('\n🔍 Searching for CSRF token patterns:');
    csrfPatterns.forEach((pattern, index) => {
      const match = response.data.match(pattern);
      if (match) {
        console.log(`✅ Pattern ${index + 1} found:`, match[1].substring(0, 20) + '...');
      } else {
        console.log(`❌ Pattern ${index + 1} not found`);
      }
    });
    
    // Look for form structure
    console.log('\n🔍 Analyzing form structure:');
    
    // Find the login form
    const formMatch = response.data.match(/<form[^>]*>([\s\S]*?)<\/form>/);
    if (formMatch) {
      const formContent = formMatch[1];
      console.log('✅ Login form found');
      
      // Find all input fields
      const inputMatches = formContent.match(/<input[^>]*>/g);
      if (inputMatches) {
        console.log('📝 Input fields found:');
        inputMatches.forEach((input, index) => {
          const nameMatch = input.match(/name=["\']([^"\']+)["\']/);
          const typeMatch = input.match(/type=["\']([^"\']+)["\']/);
          const name = nameMatch ? nameMatch[1] : 'unknown';
          const type = typeMatch ? typeMatch[1] : 'unknown';
          console.log(`  ${index + 1}. ${name} (${type})`);
        });
      }
    } else {
      console.log('❌ Login form not found');
    }
    
    // Look for username/email field expectations
    console.log('\n🔍 Checking for username/email field hints:');
    
    const labelPatterns = [
      /username/i,
      /email/i,
      /user/i,
      /login/i
    ];
    
    labelPatterns.forEach(pattern => {
      const matches = response.data.match(new RegExp(pattern, 'gi'));
      if (matches) {
        console.log(`📝 Found "${pattern.source}" references:`, matches.length);
      }
    });
    
    console.log('\n🎯 ANALYSIS COMPLETE');
    
  } catch (error) {
    console.error('❌ Failed to analyze login page:', error.message);
  }
}

analyzeProkipLoginPage();
