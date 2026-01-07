const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkConfig() {
  try {
    const config = await prisma.prokipConfig.findUnique({ where: { id: 1 } });
    console.log('Current ProkipConfig:', config);
    
    if (!config) {
      console.log('Creating ProkipConfig...');
      const newConfig = await prisma.prokipConfig.create({
        data: {
          id: 1,
          token: 'mock_prokip_token_123',
          apiUrl: 'http://localhost:4000',
          locationId: 'LOC001'
        }
      });
      console.log('Created:', newConfig);
    } else {
      console.log('ProkipConfig already exists');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkConfig();
