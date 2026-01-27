/**
 * Add prokip_sell_id column to sales_logs table using Prisma
 */

const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

async function addColumn() {
  try {
    console.log('🔧 Adding prokip_sell_id column to sales_logs table...');
    
    // Try to use Prisma to run raw SQL
    await prisma.$executeRaw`ALTER TABLE sales_logs ADD COLUMN IF NOT EXISTS prokip_sell_id VARCHAR(255)`;
    
    console.log('✅ Column added successfully!');
    
    // Verify the column exists
    const result = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'sales_logs' AND column_name = 'prokip_sell_id'`;
    
    if (result.length > 0) {
      console.log('✅ Column verification successful!');
    } else {
      console.log('❌ Column verification failed');
    }
    
  } catch (error) {
    console.error('❌ Error adding column:', error.message);
    
    // Try alternative approach
    console.log('🔄 Trying alternative approach...');
    try {
      await prisma.$executeRaw`ALTER TABLE sales_logs ADD COLUMN prokip_sell_id VARCHAR(255)`;
      console.log('✅ Column added with alternative approach!');
    } catch (altError) {
      console.error('❌ Alternative approach also failed:', altError.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

addColumn();
