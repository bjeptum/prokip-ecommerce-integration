require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function checkProkipConfig() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Checking Prokip configurations in database...');
    
    const configs = await prisma.prokipConfig.findMany();
    console.log(`📊 Found ${configs.length} Prokip configurations:`);
    
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
    
    if (configs.length === 0) {
      console.log('❌ No Prokip configurations found. User needs to login first.');
    }
    
  } catch (error) {
    console.error('❌ Error checking Prokip config:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProkipConfig();
