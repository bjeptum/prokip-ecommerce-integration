// Dynamic connection solution - find WooCommerce connection by user, not ID
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createDynamicSolution() {
  console.log('🔧 Creating Dynamic Connection Solution\n');
  
  try {
    // Check current state
    const connections = await prisma.connection.findMany();
    const prokipConfigs = await prisma.prokipConfig.findMany();
    
    console.log('📋 Current State:');
    console.log(`   Connections: ${connections.length}`);
    console.log(`   Prokip configs: ${prokipConfigs.length}`);
    
    // Find the current user's Prokip config
    const currentProkipConfig = prokipConfigs[0];
    if (!currentProkipConfig) {
      console.log('❌ No Prokip config found');
      return;
    }
    
    console.log(`✅ Current user ID: ${currentProkipConfig.userId}`);
    
    // Find WooCommerce connection for this user
    const userWooConnection = connections.find(conn => 
      conn.platform === 'woocommerce' && conn.userId === currentProkipConfig.userId
    );
    
    if (userWooConnection) {
      console.log('✅ Found WooCommerce connection for current user');
      console.log(`   Connection ID: ${userWooConnection.id}`);
      console.log(`   Store URL: ${userWooConnection.storeUrl}`);
      console.log(`   Has credentials: ${!!userWooConnection.consumerKey && !!userWooConnection.consumerSecret}`);
    } else {
      console.log('❌ No WooCommerce connection found for current user');
    }
    
    console.log('\n💡 Solution: Dynamic Connection Finding');
    console.log('Instead of hardcoded IDs like /stores/3 or /stores/4:');
    console.log('1. Frontend should find connection by user, not ID');
    console.log('2. Backend should auto-detect user\'s WooCommerce connection');
    console.log('3. Routes should work with any connection ID');
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDynamicSolution();
