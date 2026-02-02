require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Test the database connection and schema
async function testDatabaseConnection() {
  console.log('🧪 Testing Database Connection and Schema...');
  
  try {
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Test if tables exist by attempting simple queries
    console.log('\n📋 Testing Database Schema...');
    
    try {
      // Test ProkipConnection table
      const connectionCount = await prisma.prokipConnection.count();
      console.log(`✅ ProkipConnection table exists (${connectionCount} records)`);
    } catch (error) {
      console.log('❌ ProkipConnection table missing or error:', error.message);
    }
    
    try {
      // Test StockTransaction table
      const transactionCount = await prisma.stockTransaction.count();
      console.log(`✅ StockTransaction table exists (${transactionCount} records)`);
    } catch (error) {
      console.log('❌ StockTransaction table missing or error:', error.message);
    }
    
    try {
      // Test WebhookLog table
      const webhookCount = await prisma.webhookLog.count();
      console.log(`✅ WebhookLog table exists (${webhookCount} records)`);
    } catch (error) {
      console.log('❌ WebhookLog table missing or error:', error.message);
    }
    
    try {
      // Test UserIntegrationSettings table
      const settingsCount = await prisma.userIntegrationSettings.count();
      console.log(`✅ UserIntegrationSettings table exists (${settingsCount} records)`);
    } catch (error) {
      console.log('❌ UserIntegrationSettings table missing or error:', error.message);
    }
    
    try {
      // Test FailedSync table
      const failedSyncCount = await prisma.failedSync.count();
      console.log(`✅ FailedSync table exists (${failedSyncCount} records)`);
    } catch (error) {
      console.log('❌ FailedSync table missing or error:', error.message);
    }
    
    try {
      // Test ApiUsage table
      const apiUsageCount = await prisma.apiUsage.count();
      console.log(`✅ ApiUsage table exists (${apiUsageCount} records)`);
    } catch (error) {
      console.log('❌ ApiUsage table missing or error:', error.message);
    }
    
    console.log('\n🎯 Database schema test completed');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDatabaseConnection().catch(console.error);
