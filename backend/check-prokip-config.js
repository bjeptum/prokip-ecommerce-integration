const prisma = require('./src/lib/prisma');

async function checkProkipConfig() {
  try {
    console.log('🔍 Checking ProkipConfig table...');
    
    // Check all ProkipConfig records
    const allConfigs = await prisma.prokipConfig.findMany();
    console.log('📊 All ProkipConfig records:', allConfigs.length);
    
    allConfigs.forEach((config, index) => {
      console.log(`  ${index + 1}. User ID: ${config.userId}, Location ID: ${config.locationId}, Token: ${config.token ? 'present' : 'missing'}`);
    });
    
    // Check specifically for user ID 2
    const userConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 2 }
    });
    
    if (userConfig) {
      console.log('✅ Found ProkipConfig for user 2:');
      console.log('  - Location ID:', userConfig.locationId);
      console.log('  - Token:', userConfig.token ? 'present' : 'missing');
      console.log('  - Expires At:', userConfig.expiresAt);
    } else {
      console.log('❌ No ProkipConfig found for user 2');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkProkipConfig();
