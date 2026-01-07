const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setupProkipCredentials() {
  try {
    console.log('Setting up Prokip credentials for testing...');
    
    // Update the admin user with Prokip credentials
    const updatedUser = await prisma.user.update({
      where: { username: 'admin' },
      data: {
        prokipToken: 'test_prokip_token_12345',
        prokipApiUrl: 'https://api.prokip.africa',
        prokipLocationId: 'test_location_001',
        prokipUsername: 'testuser'
      }
    });
    
    console.log('✅ Prokip credentials set for admin user');
    console.log('Prokip Token:', updatedUser.prokipToken);
    console.log('Prokip API URL:', updatedUser.prokipApiUrl);
    console.log('Prokip Location ID:', updatedUser.prokipLocationId);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupProkipCredentials();
