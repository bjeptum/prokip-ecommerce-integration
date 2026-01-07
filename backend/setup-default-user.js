const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function setupDefaultUser() {
  try {
    console.log('Setting up default admin user...');
    
    // Check if default admin user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: process.env.DEFAULT_ADMIN_USER || 'admin' }
    });
    
    if (existingUser) {
      console.log('✓ Default admin user already exists');
      return;
    }
    
    // Create default admin user
    const defaultUsername = process.env.DEFAULT_ADMIN_USER || 'admin';
    const defaultPassword = process.env.DEFAULT_ADMIN_PASS || 'admin123';
    
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    const user = await prisma.user.create({
      data: {
        username: defaultUsername,
        password: hashedPassword
      }
    });
    
    console.log(`✓ Created default admin user: ${defaultUsername}`);
    console.log(`  Password: ${defaultPassword}`);
    console.log('  You can change this password after first login.');
    
  } catch (error) {
    console.error('Error setting up default user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Test database connection
async function testDatabaseConnection() {
  try {
    console.log('Testing database connection...');
    await prisma.$connect();
    console.log('✓ Database connection successful');
    
    // Run setup
    await setupDefaultUser();
    
  } catch (error) {
    console.error('Database connection failed:', error);
    console.log('\nPlease check your DATABASE_URL in .env file');
    console.log('Example: postgresql://postgres:password@localhost:5432/prokip_integration');
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  testDatabaseConnection();
}

module.exports = { setupDefaultUser, testDatabaseConnection };
