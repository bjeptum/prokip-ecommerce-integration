const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteShopifyConnections() {
  try {
    console.log('\n⚠️  WARNING: This will delete ALL Shopify connections!\n');
    
    const connections = await prisma.connection.findMany({
      where: { platform: 'shopify' }
    });
    
    if (connections.length === 0) {
      console.log('   No Shopify connections to delete.');
      await prisma.$disconnect();
      return;
    }
    
    console.log(`   Found ${connections.length} Shopify connection(s) to delete:\n`);
    connections.forEach(conn => {
      console.log(`   - ${conn.storeUrl}`);
    });
    
    console.log('\n   Deleting in 3 seconds... (Press Ctrl+C to cancel)\n');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Delete all related data first (cascade delete)
    for (const conn of connections) {
      console.log(`   Deleting data for ${conn.storeUrl}...`);
      
      await prisma.inventoryCache.deleteMany({ where: { connectionId: conn.id } });
      await prisma.salesLog.deleteMany({ where: { connectionId: conn.id } });
      await prisma.syncError.deleteMany({ where: { connectionId: conn.id } });
      
      await prisma.connection.delete({ where: { id: conn.id } });
    }
    
    console.log(`\n   ✓ Deleted ${connections.length} Shopify connection(s) and all related data`);
    console.log('\n   You can now reconnect your Shopify store from the dashboard.\n');
    
  } catch (error) {
    console.error('\n   Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

deleteShopifyConnections();
