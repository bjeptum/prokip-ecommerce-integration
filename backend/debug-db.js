const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const connections = await prisma.connection.findMany();
  console.log('All Connections:');
  connections.forEach(c => {
    console.log({
      id: c.id,
      platform: c.platform,
      storeUrl: c.storeUrl,
      userId: c.userId,
      hasToken: !!c.accessToken
    });
  });
  
  const configs = await prisma.prokipConfig.findMany();
  console.log('\nAll ProkipConfigs:');
  configs.forEach(c => {
    console.log({
      id: c.id,
      userId: c.userId,
      hasToken: !!c.token
    });
  });
  
  await prisma.$disconnect();
})();
