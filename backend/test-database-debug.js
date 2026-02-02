require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

// Test the database connection and schema
async function testDatabaseConnection() {
  console.log('🧪 Testing Database Connection and Schema...');
  
  try {
    // Test basic connection
    const prisma = new PrismaClient();
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Get all available models/tables
    console.log('\n📋 Available Database Models:');
    const models = Object.keys(prisma._modelOps || {});
    console.log('Available models:', models);
    
    // Test if tables exist by attempting simple queries
    console.log('\n📋 Testing Database Schema...');
    
    // Test basic tables first
    try {
      const userCount = await prisma.user.count();
      console.log(`✅ User table exists (${userCount} records)`);
    } catch (error) {
      console.log('❌ User table missing or error:', error.message);
    }
    
    try {
      const connectionCount = await prisma.connection.count();
      console.log(`✅ Connection table exists (${connectionCount} records)`);
    } catch (error) {
      console.log('❌ Connection table missing or error:', error.message);
    }
    
    // Test new per-user tables
    try {
      const connectionCount = await prisma.prokipConnection.count();
      console.log(`✅ ProkipConnection table exists (${connectionCount} records)`);
    } catch (error) {
      console.log('❌ ProkipConnection table missing or error:', error.message);
    }
    
    try {
      const transactionCount = await prisma.stockTransaction.count();
      console.log(`✅ StockTransaction table exists (${transactionCount} records)`);
    } catch (error) {
      console.log('❌ StockTransaction table missing or error:', error.message);
    }
    
    try {
      const webhookCount = await prisma.webhookLog.count();
      console.log(`✅ WebhookLog table exists (${webhookCount} records)`);
    } catch (error) {
      console.log('❌ WebhookLog table missing or error:', error.message);
    }
    
    try {
      const settingsCount = await prisma.userIntegrationSettings.count();
      console.log(`✅ UserIntegrationSettings table exists (${settingsCount} records)`);
    } catch (error) {
      console.log('❌ UserIntegrationSettings table missing or error:', error.message);
    }
    
    try {
      const failedSyncCount = await prisma.failedSync.count();
      console.log(`✅ FailedSync table exists (${failedSyncCount} records)`);
    } catch (error) {
      console.log('❌ FailedSync table missing or error:', error.message);
    }
    
    try {
      const apiUsageCount = await prisma.apiUsage.count();
      console.log(`✅ ApiUsage table exists (${apiUsageCount} records)`);
    } catch (error) {
      console.log('❌ ApiUsage table missing or error:', error.message);
    }
    
    console.log('\n🎯 Database schema test completed');
    
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testDatabaseConnection().catch(console.error);
