/**
 * Simple check for webhook activity (without using prokipSellId field)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSimple() {
  try {
    console.log('🔍 Checking webhook activity...\n');

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
      if (webhook.processed) {
        console.log(`  ✅ Processed at: ${webhook.processedAt}`);
      }
    });

    // Check recent sales logs (without prokipSellId)
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
    });

    // Check WooCommerce connections
    const wooConnections = await prisma.connection.findMany({
      where: { platform: 'woocommerce' },
      include: { user: true }
    });

    console.log(`\n🔗 Found ${wooConnections.length} WooCommerce connections:`);
    wooConnections.forEach(conn => {
      console.log(`- ${conn.storeUrl} (sync enabled: ${conn.syncEnabled}, last sync: ${conn.lastSync})`);
    });

    // Check if server is receiving webhooks by looking at all webhook events
    const allWebhooks = await prisma.webhookEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log(`\n📋 Last 5 webhook events overall:`);
    allWebhooks.forEach(webhook => {
      console.log(`- ${webhook.createdAt.toISOString()}: ${webhook.eventType} from connection ${webhook.connectionId}`);
    });

  } catch (error) {
    console.error('❌ Error checking activity:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSimple();
