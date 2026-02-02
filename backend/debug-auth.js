/**
 * Debug authentication to see what token is being sent and validate it
 */

const axios = require('axios');

async function debugAuthentication() {
  try {
    console.log('🔍 Debugging authentication issue...\n');
    
    // First, let's see what token the frontend has stored
    console.log('📋 Checking frontend authentication flow...');
    
    // Get the Prokip config to see what tokens are available
    const prisma = require('./src/lib/prisma');
    
    const prokipConfig = await prisma.prokipConfig.findFirst({ 
      where: { userId: 50 } 
    });
    
    console.log('🔐 Prokip Config Found:');
    console.log('   User ID:', prokipConfig?.userId);
    console.log('   Location ID:', prokipConfig?.locationId);
    console.log('   Token present:', !!prokipConfig?.token);
    console.log('   Token length:', prokipConfig?.token?.length || 0);
    console.log('   Token starts with:', prokipConfig?.token?.substring(0, 50) + '...');
    
    // Test different authentication approaches
    console.log('\n🧪 Testing different authentication methods...');
    
    // Method 1: Try with Prokip token directly
    try {
      console.log('\n1️⃣ Testing with Prokip token...');
      const response1 = await axios.post('http://localhost:3000/sync/inventory', 
        { connectionId: 10 },
        {
          headers: {
            'Authorization': `Bearer ${prokipConfig.token}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );
      console.log('✅ Prokip token works!');
    } catch (error1) {
      console.log('❌ Prokip token failed:', error1.response?.status, error1.response?.data);
    }
    
    // Method 2: Try without any token (to see what error we get)
    try {
      console.log('\n2️⃣ Testing without token...');
      const response2 = await axios.post('http://localhost:3000/sync/inventory', 
        { connectionId: 10 },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );
      console.log('✅ No token works!');
    } catch (error2) {
      console.log('❌ No token failed:', error2.response?.status, error2.response?.data);
    }
    
    // Method 3: Try with a fake JWT token
    try {
      console.log('\n3️⃣ Testing with fake JWT token...');
      const response3 = await axios.post('http://localhost:3000/sync/inventory', 
        { connectionId: 10 },
        {
          headers: {
            'Authorization': 'Bearer fake.jwt.token',
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );
      console.log('✅ Fake JWT works!');
    } catch (error3) {
      console.log('❌ Fake JWT failed:', error3.response?.status, error3.response?.data);
    }
    
    // Check if there are any user sessions/tokens
    console.log('\n🔍 Checking for user sessions...');
    
    // Look for any other authentication tokens in the database
    const connections = await prisma.connections.findMany({ 
      where: { userId: 50 },
      select: { id: true, platform: true, accessToken: true, wooUsername: true }
    });
    
    console.log('📊 Found connections:', connections.length);
    connections.forEach(conn => {
      console.log(`   ${conn.platform} (ID: ${conn.id}):`);
      console.log(`     Has accessToken: ${!!conn.accessToken}`);
      console.log(`     Has wooUsername: ${!!conn.wooUsername}`);
    });
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugAuthentication();
