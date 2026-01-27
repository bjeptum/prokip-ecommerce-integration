/**
 * Check actual database structure
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDBStructure() {
  try {
    console.log('🔍 Checking database structure...\n');

    // Check if sales_logs table exists and its columns
    try {
      const salesLogsColumns = await prisma.$queryRaw`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'sales_logs'
        ORDER BY ordinal_position
      `;
      
      console.log('📋 sales_logs table columns:');
      salesLogsColumns.forEach(col => {
        console.log(`- ${col.column_name}: ${col.data_type}`);
      });
    } catch (error) {
      console.log('❌ Error checking sales_logs columns:', error.message);
    }

    // Check webhook_events table
    try {
      const webhookEventsColumns = await prisma.$queryRaw`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'webhook_events'
        ORDER BY ordinal_position
      `;
      
      console.log('\n📋 webhook_events table columns:');
      webhookEventsColumns.forEach(col => {
        console.log(`- ${col.column_name}: ${col.data_type}`);
      });
    } catch (error) {
      console.log('❌ Error checking webhook_events columns:', error.message);
    }

    // Check connections table
    try {
      const connections = await prisma.connection.findMany({
        where: { platform: 'woocommerce' },
        take: 3
      });
      
      console.log(`\n🔗 Found ${connections.length} WooCommerce connections:`);
      connections.forEach(conn => {
        console.log(`- ID: ${conn.id}, Store: ${conn.storeUrl}, Sync: ${conn.syncEnabled}`);
      });
    } catch (error) {
      console.log('❌ Error checking connections:', error.message);
    }

  } catch (error) {
    console.error('❌ Error checking database structure:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDBStructure();
