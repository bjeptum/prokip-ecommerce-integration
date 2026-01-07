const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkUser() {
  try {
    console.log('Checking users in database...');
    
    const users = await prisma.user.findMany();
    console.log('Found users:', users.length);
    
    for (const user of users) {
      console.log(`User: ${user.username}, ID: ${user.id}`);
      
      // Test password verification
      const isValid = await bcrypt.compare('admin123', user.password);
      console.log(`Password 'admin123' valid: ${isValid}`);
      
      const isValid2 = await bcrypt.compare('securepassword123', user.password);
      console.log(`Password 'securepassword123' valid: ${isValid2}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
