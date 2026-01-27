const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTokens() {
  try {
    const configs = await prisma.prokipConfig.findMany();
    console.log('Prokip configs:', JSON.stringify(configs, null, 2));
    
    const connections = await prisma.connection.findMany({
      where: { platform: 'woocommerce' }
    });
    console.log('\nWooCommerce connections:', JSON.stringify(connections, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTokens();
