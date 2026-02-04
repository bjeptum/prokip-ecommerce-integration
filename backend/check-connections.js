const prisma = require('./src/lib/prisma');

async function checkConnections() {
  try {
    console.log('🔍 Checking connections...');
    
    // Check all connections
    const allConnections = await prisma.connection.findMany();
    console.log('📊 All connections:', allConnections.length);
    
    allConnections.forEach((conn, index) => {
      console.log(`  ${index + 1}. Platform: ${conn.platform}, User ID: ${conn.userId}, Store: ${conn.storeName || conn.storeUrl}`);
    });
    
    // Check specifically for WooCommerce
    const wooConnection = await prisma.connection.findFirst({
      where: { platform: 'woocommerce' }
    });
    
    if (wooConnection) {
      console.log('✅ Found WooCommerce connection:');
      console.log('  - User ID:', wooConnection.userId);
      console.log('  - Store URL:', wooConnection.storeUrl);
      console.log('  - Store Name:', wooConnection.storeName);
    } else {
      console.log('❌ No WooCommerce connection found');
      console.log('💡 This might be the issue - bidirectional sync requires a WooCommerce connection');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkConnections();
