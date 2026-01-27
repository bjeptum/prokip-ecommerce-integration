const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkProkipAuth() {
  try {
    console.log('🔍 Checking Prokip authentication configuration...');
    
    // Check Prokip config for user 50
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });
    
    if (!prokipConfig) {
      console.log('❌ No Prokip config found for user 50');
      return;
    }
    
    console.log('✅ Prokip config found:');
    console.log(`- User ID: ${prokipConfig.userId}`);
    console.log(`- Token: ${prokipConfig.token ? 'present' : 'missing'}`);
    console.log(`- Location ID: ${prokipConfig.locationId || 'missing'}`);
    console.log(`- Business ID: ${prokipConfig.businessId || 'missing'}`);
    console.log(`- Created: ${prokipConfig.createdAt}`);
    
    // Check if MOCK_PROKIP is set
    console.log(`\n🔧 Environment:`);
    console.log(`- MOCK_PROKIP: ${process.env.MOCK_PROKIP === 'true' ? 'true' : 'false'}`);
    console.log(`- MOCK_PROKIP_URL: ${process.env.MOCK_PROKIP_URL || 'not set'}`);
    console.log(`- PROKIP_API: ${process.env.PROKIP_API || 'not set'}`);
    
    // Check connection table for userId
    console.log(`\n🔗 Connection data:`);
    const connection = await prisma.connection.findFirst({
      where: { id: 5 }
    });
    
    if (connection) {
      console.log(`- Connection ID: ${connection.id}`);
      console.log(`- User ID: ${connection.userId || 'not set'}`);
      console.log(`- Store URL: ${connection.storeUrl}`);
    }
    
    console.log(`\n🔍 Analysis:`);
    if (prokipConfig.token && prokipConfig.locationId) {
      console.log('✅ Prokip config looks complete');
      if (process.env.MOCK_PROKIP === 'true') {
        console.log('🔧 Using Mock Mode - should work with direct database access');
      } else {
        console.log('🔧 Using Real API - should work with prokipService');
      }
    } else {
      console.log('❌ Prokip config incomplete - missing token or locationId');
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkProkipAuth();
