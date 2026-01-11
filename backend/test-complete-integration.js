require('dotenv').config();

async function testCompleteIntegration() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    console.log('🧪 Testing Complete Prokip Integration...\n');
    
    // Test 1: Check Prokip configurations
    console.log('1️⃣ Checking Prokip configurations...');
    const configs = await prisma.prokipConfig.findMany();
    console.log(`📊 Found ${configs.length} Prokip configurations:`);
    
    if (configs.length > 0) {
      configs.forEach((config, index) => {
        console.log(`\n${index + 1}. Configuration:`);
        console.log(`   ID: ${config.id}`);
        console.log(`   User ID: ${config.userId}`);
        console.log(`   Location ID: ${config.locationId}`);
        console.log(`   Token length: ${config.token ? config.token.length : 0}`);
        console.log(`   Token preview: ${config.token ? config.token.substring(0, 50) + '...' : 'No token'}`);
        console.log(`   Expires At: ${config.expiresAt}`);
        console.log(`   Created At: ${config.createdAt}`);
      });
    } else {
      console.log('❌ No Prokip configurations found. User needs to login first.');
    }
    
    // Test 2: Check users
    console.log('\n2️⃣ Checking users...');
    const users = await prisma.user.findMany();
    console.log(`👥 Found ${users.length} users:`);
    
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. User:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Prokip Authenticated: ${user.prokipAuthenticated}`);
      console.log(`   Created At: ${user.createdAt}`);
    });
    
    // Test 3: Check connections
    console.log('\n3️⃣ Checking connections...');
    const connections = await prisma.connection.findMany();
    console.log(`🔗 Found ${connections.length} connections:`);
    
    connections.forEach((conn, index) => {
      console.log(`\n${index + 1}. Connection:`);
      console.log(`   ID: ${conn.id}`);
      console.log(`   Platform: ${conn.platform}`);
      console.log(`   Store URL: ${conn.storeUrl}`);
      console.log(`   Status: ${conn.status}`);
      console.log(`   User ID: ${conn.userId}`);
    });
    
    console.log('\n✅ Integration test complete!');
    console.log('\n📋 Summary:');
    console.log(`   Prokip Configs: ${configs.length}`);
    console.log(`   Users: ${users.length}`);
    console.log(`   Connections: ${connections.length}`);
    
    if (configs.length > 0 && users.length > 0) {
      console.log('\n🎉 Integration is properly configured!');
      console.log('✅ Ready to test products and sales loading');
    } else {
      console.log('\n❌ Integration has issues that need to be resolved:');
      if (configs.length === 0) console.log('   - No Prokip configurations (login issue)');
      if (users.length === 0) console.log('   - No users created (authentication issue)');
    }
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCompleteIntegration();
