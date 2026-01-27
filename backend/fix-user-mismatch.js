// Fix the user ID mismatch issue
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixUserMismatch() {
  console.log('🔧 Fixing user ID mismatch...\n');
  
  try {
    // Get current connection and Prokip config
    const connection = await prisma.connection.findUnique({ where: { id: 1 } });
    const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId: 50 } });
    
    console.log('Current state:');
    console.log('  Connection ID 1 - User ID:', connection.userId);
    console.log('  Prokip Config - User ID:', prokipConfig.userId);
    
    // Update connection to use the same user as Prokip config
    const updatedConnection = await prisma.connection.update({
      where: { id: 1 },
      data: { userId: 50 }
    });
    
    console.log('\n✅ Fixed! Connection now uses User ID 50');
    console.log('Updated connection:', {
      id: updatedConnection.id,
      platform: updatedConnection.platform,
      userId: updatedConnection.userId
    });
    
    // Verify the fix
    const verifyConnection = await prisma.connection.findUnique({ 
      where: { id: 1 },
      include: { user: true }
    });
    
    console.log('\n🔍 Verification:');
    console.log('  Connection User ID:', verifyConnection.userId);
    console.log('  Prokip Config User ID:', prokipConfig.userId);
    console.log('  Match:', verifyConnection.userId === prokipConfig.userId ? '✅' : '❌');
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixUserMismatch();
