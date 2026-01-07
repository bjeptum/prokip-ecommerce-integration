const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function resetAdmin() {
  try {
    console.log('Resetting admin user password...');
    
    const newPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const updatedUser = await prisma.user.update({
      where: { username: 'admin' },
      data: { password: hashedPassword }
    });
    
    console.log('✅ Admin password reset successfully');
    console.log(`Username: admin`);
    console.log(`Password: ${newPassword}`);
    
    // Verify the password
    const isValid = await bcrypt.compare(newPassword, updatedUser.password);
    console.log(`Password verification: ${isValid ? '✅ Success' : '❌ Failed'}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdmin();
