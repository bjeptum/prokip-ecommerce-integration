// Check current connection IDs and fix authentication
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkConnectionsAndFixAuth() {
  console.log('🔍 Checking Current Connections and Authentication\n');
  
  try {
    // Check all connections
    const connections = await prisma.connection.findMany();
    console.log('📋 All Connections:');
    connections.forEach((conn, index) => {
      console.log(`  ${index + 1}. ID: ${conn.id}, Platform: ${conn.platform}`);
      console.log(`     Store: ${conn.storeUrl}`);
      console.log(`     User ID: ${conn.userId}`);
      console.log(`     Sync Enabled: ${conn.syncEnabled}`);
    });
    
    // Check Prokip configs
    const prokipConfigs = await prisma.prokipConfig.findMany();
    console.log('\n🔑 Prokip Configs:');
    prokipConfigs.forEach((config, index) => {
      console.log(`  ${index + 1}. User ID: ${config.userId}`);
      console.log(`     Location ID: ${config.locationId}`);
      console.log(`     Has Token: ${!!config.token}`);
    });
    
    // Check if connection ID 3 exists
    const connection3 = await prisma.connection.findUnique({ where: { id: 3 } });
    console.log('\n🔍 Connection ID 3 Check:');
    if (connection3) {
      console.log('✅ Connection ID 3 exists');
      console.log(`   Platform: ${connection3.platform}`);
      console.log(`   User ID: ${connection3.userId}`);
      
      // Check if user ID matches Prokip config
      const prokipConfig = prokipConfigs.find(config => config.userId === connection3.userId);
      if (prokipConfig) {
        console.log('✅ User ID matches Prokip config');
        console.log('💡 Authentication should work');
      } else {
        console.log('❌ User ID does NOT match any Prokip config');
        console.log('💡 This is why setup endpoints are failing');
        
        // Fix: Update connection to use correct user ID
        const correctUserId = prokipConfigs[0]?.userId;
        if (correctUserId) {
          console.log(`\n🔧 Fixing connection ID 3 user ID from ${connection3.userId} to ${correctUserId}`);
          await prisma.connection.update({
            where: { id: 3 },
            data: { userId: correctUserId }
          });
          console.log('✅ Connection user ID fixed');
        }
      }
    } else {
      console.log('❌ Connection ID 3 does NOT exist');
      console.log('💡 Frontend is trying to use non-existent connection');
    }
    
    // Test setup endpoint authentication
    console.log('\n🧪 Testing Setup Endpoint Authentication...');
    const axios = require('axios');
    
    // Get the current Prokip token
    const currentProkipConfig = prokipConfigs[0];
    if (currentProkipConfig && currentProkipConfig.token) {
      const token = currentProkipConfig.token;
      
      try {
        const response = await axios.get('http://localhost:3000/setup/products/readiness-check', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          data: { connectionId: 3 }
        });
        
        console.log('✅ Setup endpoint test successful!');
        console.log(`   Status: ${response.status}`);
        
      } catch (error) {
        console.log('❌ Setup endpoint test failed:');
        console.log(`   Status: ${error.response?.status || 'No response'}`);
        console.log(`   Error: ${error.response?.data?.error || error.message}`);
      }
    } else {
      console.log('❌ No Prokip token found for testing');
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkConnectionsAndFixAuth();
