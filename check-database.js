// Check database for existing connections and fix issues
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAndFixDatabase() {
  console.log('🔍 Checking database state...\n');
  
  try {
    // Check all connections
    const connections = await prisma.connection.findMany();
    console.log('📋 All connections in database:');
    connections.forEach((conn, index) => {
      console.log(`  ${index + 1}. ID: ${conn.id}, Platform: ${conn.platform}, Store: ${conn.storeUrl}`);
      console.log(`     User ID: ${conn.userId}, Sync Enabled: ${conn.syncEnabled}`);
      console.log(`     Created: ${conn.createdAt}, Last Sync: ${conn.lastSync}`);
    });
    
    // Check all users
    const users = await prisma.user.findMany();
    console.log('\n👥 All users in database:');
    users.forEach((user, index) => {
      console.log(`  ${index + 1}. ID: ${user.id}, Location ID: ${user.locationId}`);
      console.log(`     Has Prokip Token: ${!!user.prokipToken}`);
    });
    
    // Check Prokip configs
    const prokipConfigs = await prisma.prokipConfig.findMany();
    console.log('\n🔑 All Prokip configs in database:');
    prokipConfigs.forEach((config, index) => {
      console.log(`  ${index + 1}. ID: ${config.id}, User ID: ${config.userId}`);
      console.log(`     Location ID: ${config.locationId}, Has Token: ${!!config.token}`);
    });
    
    // Check if connection ID 1 exists
    const connection1 = await prisma.connection.findUnique({ where: { id: 1 } });
    console.log('\n🔍 Connection ID 1 check:');
    if (connection1) {
      console.log('✅ Connection ID 1 exists:', connection1.platform, connection1.storeUrl);
    } else {
      console.log('❌ Connection ID 1 does NOT exist!');
      if (connections.length > 0) {
        console.log(`💡 Available connection IDs: ${connections.map(c => c.id).join(', ')}`);
      }
    }
    
    // Fix: Update frontend to use correct connection ID
    if (connections.length > 0 && !connection1) {
      const firstConnection = connections[0];
      console.log(`\n🔧 Fix: Frontend should use connection ID ${firstConnection.id} instead of 1`);
    }
    
  } catch (error) {
    console.error('❌ Database check failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndFixDatabase();
