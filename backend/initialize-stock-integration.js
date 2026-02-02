/**
 * CREATE STOCK TRANSACTIONS TABLE
 * Run this script to create the database table for tracking stock transactions
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createStockTransactionsTable() {
  try {
    console.log('🔧 Creating stock_transactions table...');
    
    // Check if table exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'stock_transactions'
      ) as exists;
    `;
    
    if (tableExists[0].exists) {
      console.log('✅ stock_transactions table already exists');
      return;
    }
    
    // Create the table
    await prisma.$queryRaw`
      CREATE TABLE "stock_transactions" (
        "id" SERIAL NOT NULL,
        "connectionId" INTEGER NOT NULL,
        "wooOrderId" TEXT NOT NULL,
        "wooOrderNumber" TEXT NOT NULL,
        "transactionType" TEXT NOT NULL,
        "status" TEXT NOT NULL,
        "itemCount" INTEGER NOT NULL,
        "totalQuantity" INTEGER NOT NULL,
        "prokipResponse" JSONB,
        "orderData" JSONB,
        "deductions" JSONB,
        "errorMessage" TEXT,
        "retryCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        
        CONSTRAINT "stock_transactions_pkey" PRIMARY KEY ("id")
      );
    `;
    
    // Create indexes for performance
    await prisma.$queryRaw`CREATE INDEX "stock_transactions_connectionId_idx" ON "stock_transactions"("connectionId");`;
    await prisma.$queryRaw`CREATE INDEX "stock_transactions_wooOrderId_idx" ON "stock_transactions"("wooOrderId");`;
    await prisma.$queryRaw`CREATE INDEX "stock_transactions_status_idx" ON "stock_transactions"("status");`;
    await prisma.$queryRaw`CREATE INDEX "stock_transactions_transactionType_idx" ON "stock_transactions"("transactionType");`;
    await prisma.$queryRaw`CREATE INDEX "stock_transactions_createdAt_idx" ON "stock_transactions"("createdAt");`;
    
    console.log('✅ stock_transactions table created successfully');
    
  } catch (error) {
    console.error('❌ Failed to create stock_transactions table:', error.message);
    throw error;
  }
}

async function addWebhookSecretToConnections() {
  try {
    console.log('🔧 Adding webhookSecret column to connections table...');
    
    // Check if column exists
    const columnExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'connections' 
        AND column_name = 'webhookSecret'
      ) as exists;
    `;
    
    if (columnExists[0].exists) {
      console.log('✅ webhookSecret column already exists in connections table');
      return;
    }
    
    // Add the column
    await prisma.$queryRaw`ALTER TABLE "connections" ADD COLUMN "webhookSecret" TEXT;`;
    
    console.log('✅ webhookSecret column added to connections table');
    
  } catch (error) {
    console.error('❌ Failed to add webhookSecret column:', error.message);
    throw error;
  }
}

async function initializeDatabase() {
  try {
    console.log('🚀 Initializing database for WooCommerce to Prokip integration...\n');
    
    await createStockTransactionsTable();
    await addWebhookSecretToConnections();
    
    console.log('\n✅ Database initialization completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Add webhook routes to app.js');
    console.log('2. Configure WooCommerce webhooks');
    console.log('3. Test the integration');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the initialization
initializeDatabase();
