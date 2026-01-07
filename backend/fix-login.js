const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function fixLoginIssue() {
  try {
    console.log('🔧 Fixing login issue...');
    
    // Check current users
    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} users in database:`);
    
    for (const user of users) {
      console.log(`- Username: ${user.username}, ID: ${user.id}`);
    }
    
    // Set the correct password based on your .env.example
    const correctPassword = 'changeme123';
    const hashedPassword = await bcrypt.hash(correctPassword, 10);
    
    // Update or create admin user with correct password
    const adminUser = await prisma.user.upsert({
      where: { username: 'admin' },
      update: { 
        password: hashedPassword,
        prokipToken: 'test_prokip_token_12345',
        prokipApiUrl: 'https://api.prokip.africa',
        prokipLocationId: 'test_location_001',
        prokipUsername: 'testuser'
      },
      create: {
        username: 'admin',
        password: hashedPassword,
        prokipToken: 'test_prokip_token_12345',
        prokipApiUrl: 'https://api.prokip.africa',
        prokipLocationId: 'test_location_001',
        prokipUsername: 'testuser'
      }
    });
    
    console.log('✅ Admin user updated with correct password');
    console.log(`Username: admin`);
    console.log(`Password: ${correctPassword}`);
    
    // Test the password
    const isValid = await bcrypt.compare(correctPassword, adminUser.password);
    console.log(`Password verification: ${isValid ? '✅ Success' : '❌ Failed'}`);
    
    // Test login endpoint
    console.log('\n🧪 Testing login endpoint...');
    try {
      const axios = require('axios');
      const response = await axios.post('http://localhost:3000/auth/login', {
        username: 'admin',
        password: correctPassword
      });
      
      console.log('✅ Login test successful!');
      console.log('Token received:', response.data.token ? '✅ Yes' : '❌ No');
      
    } catch (loginError) {
      console.log('❌ Login test failed:', loginError.response?.data || loginError.message);
    }
    
  } catch (error) {
    console.error('❌ Error fixing login:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixLoginIssue();
