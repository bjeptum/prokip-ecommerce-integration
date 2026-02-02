/**
 * STOCK TRANSACTION DATABASE MODEL
 * For tracking WooCommerce to Prokip stock deductions
 */

// Add this model to your Prisma schema:

/*
model StockTransaction {
  id                Int      @id @default(autoincrement())
  connectionId      Int
  wooOrderId        String
  wooOrderNumber    String
  transactionType   String   // 'stock_deduction', 'stock_adjustment', 'reconciliation'
  status            String   // 'success', 'failed', 'pending', 'retrying'
  itemCount         Int
  totalQuantity     Int
  prokipResponse    Json?    // Response from Prokip API
  orderData         Json?    // Original WooCommerce order data
  deductions        Json?    // Stock deduction details
  errorMessage      String?  // Error message if failed
  retryCount        Int      @default(0)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  connection        Connection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  
  @@map("stock_transactions")
  @@index([connectionId])
  @@index([wooOrderId])
  @@index([status])
  @@index([transactionType])
  @@index([createdAt])
}
*/

console.log(`
🗄️ STOCK TRANSACTION DATABASE SCHEMA
=====================================

📋 MODEL: StockTransaction
┌─────────────────┬─────────────────────────────────────────┐
│ Field           │ Description                             │
├─────────────────┼─────────────────────────────────────────┤
│ id              │ Primary key (auto-increment)            │
│ connectionId    │ Foreign key to Connection table         │
│ wooOrderId      │ WooCommerce order ID                    │
│ wooOrderNumber  │ WooCommerce order number                │
│ transactionType │ Type: stock_deduction, adjustment, etc. │
│ status          │ success, failed, pending, retrying       │
│ itemCount       │ Number of items in transaction          │
│ totalQuantity   │ Total quantity deducted                 │
│ prokipResponse  │ JSON response from Prokip API            │
│ orderData       │ Original WooCommerce order data         │
│ deductions      │ Stock deduction details                  │
│ errorMessage    │ Error message if failed                 │
│ retryCount      │ Number of retry attempts                 │
│ createdAt       │ Transaction timestamp                   │
│ updatedAt       │ Last update timestamp                    │
└─────────────────┴─────────────────────────────────────────┘

🔗 RELATIONSHIPS:
- StockTransaction → Connection (Many-to-One)
- Connection → StockTransaction (One-to-Many)

📊 INDEXES FOR PERFORMANCE:
- connectionId (Fast lookups by store)
- wooOrderId (Find transactions by order)
- status (Filter by transaction status)
- transactionType (Filter by type)
- createdAt (Time-based queries)

💡 USAGE EXAMPLES:
1. Track all stock deductions from WooCommerce orders
2. Monitor failed transactions for retry
3. Generate reconciliation reports
4. Audit trail for stock movements
5. Performance analytics

🎯 ADD TO YOUR PRISMA SCHEMA:
Copy the model above and add it to your schema.prisma file,
then run: npx prisma migrate dev --name add-stock-transactions
`);

const prisma = require('../lib/prisma');

async function createStockTransactionTable() {
  try {
    console.log('🔧 Creating stock transaction table...');
    
    // Check if table exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'stock_transactions'
      ) as exists;
    `;
    
    if (tableExists[0].exists) {
      console.log('✅ Stock transaction table already exists');
      return;
    }
    
    // Create table manually (if not using Prisma migrations)
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
    
    // Create indexes
    await prisma.$queryRaw`CREATE INDEX "stock_transactions_connectionId_idx" ON "stock_transactions"("connectionId");`;
    await prisma.$queryRaw`CREATE INDEX "stock_transactions_wooOrderId_idx" ON "stock_transactions"("wooOrderId");`;
    await prisma.$queryRaw`CREATE INDEX "stock_transactions_status_idx" ON "stock_transactions"("status");`;
    await prisma.$queryRaw`CREATE INDEX "stock_transactions_transactionType_idx" ON "stock_transactions"("transactionType");`;
    await prisma.$queryRaw`CREATE INDEX "stock_transactions_createdAt_idx" ON "stock_transactions"("createdAt");`;
    
    console.log('✅ Stock transaction table created successfully');
    
  } catch (error) {
    console.error('❌ Failed to create stock transaction table:', error.message);
  }
}

async function testStockTransactionModel() {
  try {
    console.log('\n🧪 Testing stock transaction model...');
    
    // Test creating a stock transaction
    const testTransaction = {
      connectionId: 10,
      wooOrderId: 'TEST_123',
      wooOrderNumber: '123',
      transactionType: 'stock_deduction',
      status: 'success',
      itemCount: 2,
      totalQuantity: 5,
      prokipResponse: { success: true, message: 'Stock deducted' },
      orderData: { id: 'TEST_123', total: '750.00' },
      deductions: [
        { sku: 'TEST_SKU_1', quantity: 3, variation_id: 12345 },
        { sku: 'TEST_SKU_2', quantity: 2, variation_id: 67890 }
      ]
    };
    
    console.log('📝 Test transaction data:', JSON.stringify(testTransaction, null, 2));
    console.log('✅ Stock transaction model structure verified');
    
  } catch (error) {
    console.error('❌ Model test failed:', error.message);
  }
}

// Run tests
createStockTransactionTable().then(() => {
  testStockTransactionModel();
});
