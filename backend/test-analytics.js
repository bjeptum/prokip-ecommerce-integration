const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const config = await prisma.prokipConfig.findFirst();
  const token = config.token;
  
  console.log('Testing analytics endpoint...');
  
  const response = await fetch('http://localhost:3000/stores/3/analytics', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  console.log('Status:', response.status);
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
  
  await prisma.$disconnect();
})();
