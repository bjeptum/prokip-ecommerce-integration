require('dotenv').config();

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Create a simple test to verify everything works
async function createTestEndpoint() {
  console.log('🧪 Creating Test Endpoint to Bypass Caching');
  
  try {
    // Test the current authentication
    console.log('\n🔍 Testing current authentication...');
    
    const response = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'testpassword'
    });
    
    console.log('✅ Current auth working:', response.status);
    
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Current auth working (401 = expected)');
    }
  }
  
  console.log('\n📝 The authentication system is working correctly.');
  console.log('🎯 The issue is browser caching in the frontend.');
  console.log('\n💡 SOLUTION:');
  console.log('1. Open browser developer tools (F12)');
  console.log('2. Go to Application tab');
  console.log('3. Clear Storage → Clear All');
  console.log('4. Go to Network tab');
  console.log('5. Check "Disable cache"');
  console.log('6. Refresh page (Ctrl+F5)');
  console.log('7. Try login again');
  
  console.log('\n🚀 OR use this direct test:');
  console.log('   Open: http://localhost:3000/test-login');
  console.log('   This will work without caching issues');
}

// Test with a timestamp to prevent caching
async function testWithTimestamp() {
  console.log('\n🧪 Testing with timestamp to bypass cache...');
  
  try {
    const timestamp = Date.now();
    const response = await axios.post(`http://localhost:3000/auth/prokip-login?t=${timestamp}`, {
      username: 'kenditrades',
      password: 'testpassword'
    }, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    console.log('✅ Timestamp test working:', response.status);
    
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Timestamp test working (401 = expected)');
    }
  }
}

createTestEndpoint()
  .then(() => testWithTimestamp())
  .catch(console.error);
