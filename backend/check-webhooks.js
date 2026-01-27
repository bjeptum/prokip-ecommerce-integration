/**
 * Check for recent webhook activity and sales logs
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkWebhookActivity() {
  try {
    console.log('🔍 Checking recent webhook activity...\n');

    // Check recent webhook events
    const recentWebhooks = await prisma.webhookEvent.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    console.log(`📊 Found ${recentWebhooks.length} webhook events in last 24 hours:`);
    recentWebhooks.forEach(webhook => {
      console.log(`- ${webhook.createdAt.toISOString()}: ${webhook.eventType} (processed: ${webhook.processed})`);
      if (webhook.errorMessage) {
        console.log(`  ❌ Error: ${webhook.errorMessage}`);
      }
    });

    // Check recent sales logs
    const recentSales = await prisma.salesLog.findMany({
      where: {
        syncedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: { syncedAt: 'desc' },
      take: 10
    });

    console.log(`\n💰 Found ${recentSales.length} sales logs in last 24 hours:`);
    recentSales.forEach(sale => {
      console.log(`- ${sale.syncedAt.toISOString()}: Order ${sale.orderId} (${sale.totalAmount}) - ${sale.status}`);
      if (sale.prokipSellId) {
        console.log(`  ✅ Prokip Sale ID: ${sale.prokipSellId}`);
      }
    });

    // Check sync errors
    const recentErrors = await prisma.syncError.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    if (recentErrors.length > 0) {
      console.log(`\n❌ Found ${recentErrors.length} sync errors in last 24 hours:`);
      recentErrors.forEach(error => {
        console.log(`- ${error.createdAt.toISOString()}: ${error.errorType} - ${error.errorMessage}`);
      });
    } else {
      console.log(`\n✅ No sync errors found in last 24 hours`);
    }

    // Check WooCommerce connections
    const wooConnections = await prisma.connection.findMany({
      where: { platform: 'woocommerce' },
      include: { user: true }
    });

    console.log(`\n🔗 Found ${wooConnections.length} WooCommerce connections:`);
    wooConnections.forEach(conn => {
      console.log(`- ${conn.storeUrl} (sync enabled: ${conn.syncEnabled}, last sync: ${conn.lastSync})`);
    });

  } catch (error) {
    console.error('❌ Error checking webhook activity:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkWebhookActivity();
