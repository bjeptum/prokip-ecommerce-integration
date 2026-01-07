const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkConnections() {
  try {
    const connections = await prisma.connection.findMany();
    console.log('\n📊 Connected Stores:\n');
    
    if (connections.length === 0) {
      console.log('   No stores connected yet');
    } else {
      connections.forEach((conn, index) => {
        console.log(`${index + 1}. ${conn.platform.toUpperCase()}`);
        console.log(`   Store URL: ${conn.storeUrl}`);
        console.log(`   Access Token: ${conn.accessToken ? '✓ Present' : '✗ Missing'}`);
        console.log(`   Consumer Key: ${conn.consumerKey ? '✓ Present' : '✗ Missing'}`);
        console.log(`   Last Sync: ${conn.lastSync || 'Never'}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkConnections();
