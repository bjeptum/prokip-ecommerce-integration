require('dotenv').config();

const ProkipUserAuthService = require('./src/services/prokipUserAuthService');

// Test what the service actually returns
async function testServiceResponse() {
  console.log('🔍 Testing Service Response Structure');
  console.log('=' .repeat(50));
  
  try {
    const authService = new ProkipUserAuthService();
    
    console.log('📝 Testing with kenditrades...');
    
    const result = await authService.authenticateUser(
      'test-user-123',
      'kenditrades',
      'testpassword',
      'Test Connection'
    );
    
    console.log('✅ Service returned:');
    console.log('📊 Result type:', typeof result);
    console.log('📊 Result keys:', Object.keys(result));
    console.log('📊 Result.success:', result.success);
    
    if (result.data) {
      console.log('📊 Result.data type:', typeof result.data);
      console.log('📊 Result.data keys:', Object.keys(result.data));
      
      if (result.data.data) {
        console.log('📊 Result.data.data type:', typeof result.data.data);
        console.log('📊 Result.data.data keys:', Object.keys(result.data.data));
        console.log('📊 Result.data.data.user:', result.data.data.user);
        console.log('📊 Result.data.data.connectionId:', result.data.data.connectionId);
      }
    }
    
    console.log('\n📊 Full result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Service test failed:', error.message);
    console.error('📊 Error type:', error.constructor.name);
    console.error('📊 Stack:', error.stack);
  }
}

testServiceResponse();
