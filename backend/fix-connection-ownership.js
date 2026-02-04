const prisma = require('./src/lib/prisma');

async function fixConnectionOwnership() {
  try {
    console.log('🔧 Fixing connection ownership...');
    
    // Update WooCommerce connection to belong to user ID 2
    const result = await prisma.connection.updateMany({
      where: { platform: 'woocommerce' },
      data: { userId: 2 }
    });
    
    console.log('✅ Updated connections:', result.count);
    
    // Verify the fix
    const wooConnection = await prisma.connection.findFirst({
      where: { platform: 'woocommerce' }
    });
    
    if (wooConnection) {
      console.log('✅ WooCommerce connection now belongs to user:', wooConnection.userId);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixConnectionOwnership();
