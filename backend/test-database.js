require('dotenv').config();

async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing database connection...');
    
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Test query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Basic query successful:', result);
    
    // Check available models
    console.log('\n📋 Available Prisma models:');
    const models = Object.keys(prisma._engineModel.models);
    models.forEach(model => {
      console.log(`   - ${model}`);
    });
    
    await prisma.$disconnect();
    console.log('✅ Database test completed successfully');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
  }
}

testDatabaseConnection();
