// Check what Prokip token is actually stored and used
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTokens() {
  console.log('🔍 Checking Prokip tokens...\n');
  
  try {
    // Get all Prokip configs
    const prokipConfigs = await prisma.prokipConfig.findMany();
    console.log('📋 All Prokip configs:');
    prokipConfigs.forEach((config, index) => {
      console.log(`  ${index + 1}. User ID: ${config.userId}`);
      console.log(`     Token length: ${config.token ? config.token.length : 0}`);
      console.log(`     Token preview: ${config.token ? config.token.substring(0, 50) + '...' : 'null'}`);
      console.log(`     Location ID: ${config.locationId}`);
    });
    
    // Check what token frontend is using (from logs)
    const frontendToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImY0NWFlNjQ5NzI3ZjQ3ZmYzZjBmMGYzZWE5ZWJlNTBmZjhjNDg3YjRlMjVlZGVlOTM1MmFhNDI4YWU2OTk0MzRkMGQ3OGEwYWU3In0.eyJhdWQiOiI2IiwianRpIjoiImY0NWFlNjQ5NzI3ZjQ3ZmYzZjBmMGYzZWE5ZWJlNTBmZjhjNDg3YjRlMjVlZGVlOTM1MmFhNDI4YWU2OTk0MzRkMGQ3OGEwYWU3IiwiaWF0IjoxNzY4MTYxNjQ0LCJuYmYiOjE3NjgxNjE2NDQsImV4cCI6MTc5OTY5NjA0NCwic3ViIjoiNDQ4ODEiLCJzY29wZXMiOl19';
    
    console.log('\n🔍 Frontend token from logs:');
    console.log(`  Length: ${frontendToken.length}`);
    console.log(`  Preview: ${frontendToken.substring(0, 50)}...`);
    
    // Check if frontend token matches any stored token
    const matchingConfig = prokipConfigs.find(config => config.token === frontendToken);
    if (matchingConfig) {
      console.log('\n✅ Frontend token matches stored config!');
      console.log(`  Matches User ID: ${matchingConfig.userId}`);
    } else {
      console.log('\n❌ Frontend token does NOT match any stored config!');
      console.log('💡 This is why authentication is failing');
      
      // Find the most recent config
      if (prokipConfigs.length > 0) {
        const latestConfig = prokipConfigs[0];
        console.log('\n🔧 Fix: Update frontend to use this token:');
        console.log(`  Token: ${latestConfig.token}`);
        console.log(`  Length: ${latestConfig.token.length}`);
        console.log(`  User ID: ${latestConfig.userId}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTokens();
