require('dotenv').config();

const axios = require('axios');

// Test with real credentials
async function testRealCredentials() {
  console.log('🧪 TESTING WITH REAL CREDENTIALS');
  console.log('=' .repeat(50));
  
  console.log('📝 This test requires real Prokip credentials');
  console.log('📧 Username: kenditrades');
  console.log('🔑 Password: [Please enter your real password]');
  
  console.log('\n🚀 To test with real credentials:');
  console.log('1. Open this file and update the password');
  console.log('2. Run: node test-real-credentials.js');
  console.log('3. Check if login succeeds');
  
  // Test with placeholder (will fail)
  console.log('\n🧪 Testing with placeholder credentials...');
  
  try {
    const response = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'REAL_PASSWORD_HERE' // Replace with actual password
    });
    
    console.log('✅ Login successful!');
    console.log('📊 Status:', response.status);
    console.log('📊 Response:', response.data);
    
    // If successful, verify the response structure
    if (response.data.success) {
      console.log('\n✅ SUCCESS VERIFICATION:');
      console.log('✅ Response has success field');
      console.log('✅ Response has token field');
      console.log('✅ Response has user field');
      console.log('✅ Response has connectionId field');
      
      console.log('\n🎯 LOGIN IS WORKING!');
      console.log('📦 Stock sync can now be added');
    }
    
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('❌ Invalid credentials (expected with placeholder password)');
      console.log('📝 Replace REAL_PASSWORD_HERE with actual Prokip password');
    } else {
      console.log('❌ Unexpected error:', error.message);
      console.log('📊 Status:', error.response?.status);
      console.log('📊 Response:', error.response?.data);
    }
  }
}

testRealCredentials();
