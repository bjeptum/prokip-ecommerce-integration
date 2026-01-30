const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function debugRecentWebhookActivity() {
  console.log('🔍 Debugging Recent Webhook Activity');
  console.log('=====================================');

  try {
    // 1. Check recent webhook events
    console.log('\n1️⃣ Checking recent webhook events...');
    const recentWebhooks = await prisma.webhookEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    if (recentWebhooks.length > 0) {
      console.log(`✅ Found ${recentWebhooks.length} recent webhook events:`);
      recentWebhooks.forEach(webhook => {
        console.log(`   ${webhook.createdAt.toISOString()} - ${webhook.topic} - ${webhook.storeUrl}`);
      });
    } else {
      console.log('ℹ️ No recent webhook events found');
    }

    // 2. Check recent sales logs
    console.log('\n2️⃣ Checking recent sales logs...');
    const recentSales = await prisma.salesLog.findMany({
      orderBy: { syncedAt: 'desc' },
      take: 10
    });

    if (recentSales.length > 0) {
      console.log(`✅ Found ${recentSales.length} recent sales logs:`);
      recentSales.forEach(sale => {
        console.log(`   Order ${sale.orderId} (${sale.platform}) - ${sale.status} - Stock Deducted: ${sale.stockDeducted}`);
      });
    } else {
      console.log('ℹ️ No recent sales logs found');
    }

    // 3. Check recent sync errors
    console.log('\n3️⃣ Checking recent sync errors...');
    const recentErrors = await prisma.syncError.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    if (recentErrors.length > 0) {
      console.log(`❌ Found ${recentErrors.length} recent sync errors:`);
      recentErrors.forEach(error => {
        console.log(`   ${error.createdAt.toISOString()} - ${error.errorType}: ${error.errorMessage}`);
      });
    } else {
      console.log('✅ No recent sync errors found');
    }

    // 4. Check current inventory state
    console.log('\n4️⃣ Checking current inventory state...');
    const inventoryLogs = await prisma.inventoryLog.findMany({
      orderBy: { lastSynced: 'desc' },
      take: 10
    });

    if (inventoryLogs.length > 0) {
      console.log(`✅ Current inventory levels:`);
      inventoryLogs.forEach(log => {
        console.log(`   SKU ${log.sku}: ${log.quantity} units (Last synced: ${log.lastSynced?.toISOString()})`);
      });
    } else {
      console.log('ℹ️ No inventory logs found');
    }

    // 5. Test webhook endpoint accessibility
    console.log('\n5️⃣ Testing webhook endpoint...');
    try {
      const response = await axios.get('http://localhost:3000/connections/webhook/woocommerce', {
        timeout: 5000,
        validateStatus: (status) => status < 500 // Accept 4xx as endpoint exists
      });
      console.log(`✅ Webhook endpoint accessible (Status: ${response.status})`);
    } catch (error) {
      console.log(`❌ Webhook endpoint error: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run debug
debugRecentWebhookActivity();
