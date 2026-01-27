const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkConnections() {
  try {
    const connections = await prisma.connection.findMany();
    console.log('📋 All connections:');
    connections.forEach(conn => {
      console.log(`- ID: ${conn.id}, Platform: ${conn.platform}, Store: ${conn.storeUrl}`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkConnections();
