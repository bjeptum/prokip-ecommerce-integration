require('dotenv').config();

const axios = require('axios');

// Comprehensive debugging of the authentication flow
async function debugAuthenticationFlow() {
  console.log('🔍 COMPREHENSIVE AUTHENTICATION DEBUG');
  console.log('=' .repeat(60));
  
  console.log('📋 Environment Variables:');
  console.log('  MOCK_PROKIP:', process.env.MOCK_PROKIP);
  console.log('  PROKIP_BASE_URL:', process.env.PROKIP_BASE_URL);
  console.log('  ENCRYPTION_SECRET:', process.env.ENCRYPTION_SECRET ? 'Set' : 'NOT SET');
  
  console.log('\n🧪 Step 1: Testing Direct OAuth2 API Call');
  console.log('-' .repeat(50));
  
  try {
    const oauthData = {
      username: 'kenditrades',
      password: 'testpassword', // Test password
      desktop_version: '',
      client_id: '6',
      client_secret: 'vkbDU9dKp3iO3h0Yjc3C9sRSmnvBsq5qdtMTEarK',
      grant_type: 'password',
      scope: ''
    };
    
    console.log('📊 Sending OAuth2 request to:', process.env.PROKIP_BASE_URL + '/oauth/token');
    console.log('📊 Data:', JSON.stringify(oauthData, null, 2));
    
    const response = await axios.post(`${process.env.PROKIP_BASE_URL}/oauth/token`, oauthData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    });
    
    console.log('✅ Direct OAuth2 API Response:');
    console.log('  Status:', response.status);
    console.log('  Headers:', JSON.stringify(response.headers, null, 2));
    console.log('  Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Direct OAuth2 API failed:', error.message);
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  console.log('\n🧪 Step 2: Testing Backend Authentication Endpoint');
  console.log('-' .repeat(50));
  
  try {
    const loginData = {
      username: 'kenditrades',
      password: 'testpassword'
    };
    
    console.log('📊 Sending to backend:', 'http://localhost:3000/auth/prokip-login');
    console.log('📊 Data:', JSON.stringify(loginData, null, 2));
    
    const backendResponse = await axios.post('http://localhost:3000/auth/prokip-login', loginData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Backend Response:');
    console.log('  Status:', backendResponse.status);
    console.log('  Data:', JSON.stringify(backendResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ Backend authentication failed:', error.message);
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  console.log('\n🧪 Step 3: Testing Authentication Service Directly');
  console.log('-' .repeat(50));
  
  try {
    const ProkipUserAuthService = require('./src/services/prokipUserAuthService');
    const authService = new ProkipUserAuthService();
    
    console.log('📝 Testing service with kenditrades...');
    
    const serviceResult = await authService.authenticateUser(
      'debug-user-123',
      'kenditrades',
      'testpassword',
      'Debug Connection'
    );
    
    console.log('✅ Service Result:');
    console.log('  Success:', serviceResult.success);
    console.log('  Data:', JSON.stringify(serviceResult.data, null, 2));
    
  } catch (error) {
    console.error('❌ Service authentication failed:', error.message);
    console.error('  Stack:', error.stack);
  }
  
  console.log('\n🧪 Step 4: Checking Database Connection');
  console.log('-' .repeat(50));
  
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    console.log('📊 Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connected');
    
    console.log('📊 Checking ProkipConnection table...');
    const connections = await prisma.prokipConnection.findMany({
      where: { userId: 'debug-user-123' }
    });
    
    console.log('✅ Found connections:', connections.length);
    connections.forEach(conn => {
      console.log(`  - ${conn.id}: ${conn.prokipEmail} (Active: ${conn.isActive})`);
    });
    
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  }
  
  console.log('\n🧪 Step 5: Testing with Real Credentials');
  console.log('-' .repeat(50));
  console.log('📝 Now testing with actual credentials...');
  console.log('📝 If you have real Prokip credentials, please enter them below:');
  console.log('   Email: kenditrades');
  console.log('   Password: [your actual password]');
  console.log('\n📋 The system should now work with real credentials!');
  console.log('🎯 Go to http://localhost:3000 and try logging in.');
  
}

// Run the comprehensive debug
debugAuthenticationFlow().catch(console.error);
