/**
 * QUICK DATABASE CHECK: Sales logs and stock reduction status
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function quickDatabaseCheck() {
  console.log('🔍 QUICK DATABASE CHECK');
  console.log('=' .repeat(50));

  try {
    // 1. Check sales logs
    console.log('\n📋 Sales Logs:');
    const salesLogs = await prisma.salesLog.findMany({
      orderBy: { syncedAt: 'desc' },
      take: 5
    });

    if (salesLogs.length === 0) {
      console.log('   ❌ No sales logs found');
    } else {
      salesLogs.forEach(log => {
        console.log(`   Order ${log.orderId}: Stock Deducted = ${log.stockDeducted}`);
      });
    }

    // 2. Check webhook events
    console.log('\n📋 Webhook Events:');
    const webhookEvents = await prisma.webhookEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    webhookEvents.forEach(event => {
      console.log(`   Event ${event.id}: Processed = ${event.processed}`);
    });

    // 3. Check sync errors
    console.log('\n📋 Sync Errors:');
    const syncErrors = await prisma.syncError.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3
    });

    if (syncErrors.length === 0) {
      console.log('   ✅ No sync errors');
    } else {
      syncErrors.forEach(error => {
        console.log(`   ${error.errorType}: ${error.errorMessage}`);
      });
    }

  } catch (error) {
    console.error('❌ Check failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

quickDatabaseCheck();
