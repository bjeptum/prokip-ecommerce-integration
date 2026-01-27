// Check current connections and fix issues
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCurrentState() {
  console.log('🔍 Checking current system state...\n');
  
  try {
    // Check all connections
    const connections = await prisma.connection.findMany();
    console.log('📋 All connections:');
    connections.forEach((conn, index) => {
      console.log(`  ${index + 1}. ID: ${conn.id}, Platform: ${conn.platform}`);
      console.log(`     Store: ${conn.storeUrl}`);
      console.log(`     User ID: ${conn.userId}`);
      console.log(`     Has WooCommerce credentials: ${!!conn.wooUsername && !!conn.wooAppPassword}`);
      console.log(`     Sync Enabled: ${conn.syncEnabled}`);
    });
    
    // Check Prokip configs
    const prokipConfigs = await prisma.prokipConfig.findMany();
    console.log('\n🔑 Prokip configs:');
    prokipConfigs.forEach((config, index) => {
      console.log(`  ${index + 1}. User ID: ${config.userId}`);
      console.log(`     Has Token: ${!!config.token}`);
      console.log(`     Location ID: ${config.locationId}`);
    });
    
    // Check if connection ID 2 exists
    const connection2 = await prisma.connection.findUnique({ where: { id: 2 } });
    console.log('\n🔍 Connection ID 2 check:');
    if (connection2) {
      console.log('✅ Connection ID 2 exists');
      console.log(`   Platform: ${connection2.platform}`);
      console.log(`   Store: ${connection2.storeUrl}`);
      console.log(`   User ID: ${connection2.userId}`);
      console.log(`   Has WooCommerce credentials: ${!!connection2.wooUsername && !!connection2.wooAppPassword}`);
      
      // Check if user ID matches Prokip config
      const prokipConfig = prokipConfigs.find(config => config.userId === connection2.userId);
      if (prokipConfig) {
        console.log('✅ User ID matches Prokip config');
      } else {
        console.log('❌ User ID does NOT match any Prokip config');
        console.log('💡 This is why setup endpoints are failing');
      }
    } else {
      console.log('❌ Connection ID 2 does NOT exist');
    }
    
    console.log('\n🔧 Issues found:');
    console.log('1. Analytics endpoint missing (/stores/2/analytics)');
    console.log('2. Setup endpoints failing (authentication)');
    console.log('3. Connection ID mismatch issues');
    
    console.log('\n🛠️  Fixes needed:');
    console.log('1. Create analytics endpoint');
    console.log('2. Fix authentication for setup routes');
    console.log('3. Ensure user ID consistency');
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCurrentState();
