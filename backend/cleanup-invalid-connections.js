const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupInvalidConnections() {
  try {
    console.log('\n🔍 Checking for invalid Shopify connections...\n');
    
    const connections = await prisma.connection.findMany({
      where: { platform: 'shopify' }
    });
    
    if (connections.length === 0) {
      console.log('   No Shopify connections found.');
      return;
    }
    
    console.log(`   Found ${connections.length} Shopify connection(s):\n`);
    
    for (const conn of connections) {
      console.log(`   ${conn.id}. ${conn.storeUrl}`);
      console.log(`      Access Token: ${conn.accessToken ? conn.accessToken.substring(0, 20) + '...' : 'Missing'}`);
      console.log(`      Last Sync: ${conn.lastSync || 'Never'}`);
      console.log('');
    }
    
    console.log('\n⚠️  If you\'re getting authentication errors, you should:');
    console.log('   1. Delete the invalid connection from your dashboard, OR');
    console.log('   2. Run this command to remove all Shopify connections:');
    console.log('      npm run cleanup-shopify');
    console.log('\n   Then reconnect your store through the dashboard.\n');
    
    // Optional: Uncomment to auto-delete invalid connections
    // const deleted = await prisma.connection.deleteMany({
    //   where: { platform: 'shopify' }
    // });
    // console.log(`✓ Deleted ${deleted.count} Shopify connection(s)`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupInvalidConnections();
