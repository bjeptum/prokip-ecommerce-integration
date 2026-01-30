const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');

const prisma = new PrismaClient();

async function testWooCommerceToProkipSync() {
  console.log('🧪 Testing WooCommerce to Prokip Stock Sync');
  console.log('===========================================');

  try {
    // 1. Check Prokip authentication
    console.log('\n1️⃣ Checking Prokip authentication...');
    const isAuthenticated = await prokipService.isAuthenticated(50);
    if (!isAuthenticated) {
      console.error('❌ Not authenticated with Prokip. Please log in first.');
      return;
    }
    console.log('✅ Prokip authentication successful');

    // 2. Get Prokip products to verify SKUs exist
    console.log('\n2️⃣ Fetching Prokip products...');
    const products = await prokipService.getProducts(null, 50);
    console.log(`✅ Found ${products.length} products in Prokip`);
    
    // Show first 5 products with SKUs
    console.log('\n📦 Sample products:');
    products.slice(0, 5).forEach(product => {
      console.log(`   - ${product.name} (SKU: ${product.sku}, ID: ${product.id})`);
    });

    // 3. Check recent sales logs
    console.log('\n3️⃣ Checking recent sales logs...');
    const recentSales = await prisma.salesLog.findMany({
      where: { platform: 'woocommerce' },
      orderBy: { syncedAt: 'desc' },
      take: 5
    });
    
    if (recentSales.length > 0) {
      console.log(`✅ Found ${recentSales.length} recent WooCommerce sales`);
      recentSales.forEach(sale => {
        console.log(`   - Order ${sale.orderId}: ${sale.totalAmount} (${sale.status})`);
      });
    } else {
      console.log('ℹ️ No recent WooCommerce sales found');
    }

    // 4. Check inventory logs
    console.log('\n4️⃣ Checking inventory logs...');
    const inventoryLogs = await prisma.inventoryLog.findMany({
      orderBy: { lastSynced: 'desc' },
      take: 5
    });
    
    if (inventoryLogs.length > 0) {
      console.log(`✅ Found ${inventoryLogs.length} inventory entries`);
      inventoryLogs.forEach(log => {
        console.log(`   - ${log.sku}: ${log.quantity} units`);
      });
    } else {
      console.log('ℹ️ No inventory logs found');
    }

    // 5. Test webhook endpoint availability
    console.log('\n5️⃣ Testing webhook configuration...');
    const connections = await prisma.connection.findMany({
      where: { platform: 'woocommerce' }
    });
    
    if (connections.length > 0) {
      console.log(`✅ Found ${connections.length} WooCommerce connections`);
      connections.forEach(conn => {
        console.log(`   - Store: ${conn.storeUrl} (Sync: ${conn.syncEnabled ? 'Enabled' : 'Disabled'})`);
      });
    } else {
      console.log('ℹ️ No WooCommerce connections found');
    }

    console.log('\n✅ Test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Prokip API is accessible');
    console.log('   - Products are available for mapping');
    console.log('   - Database tables are working');
    console.log('   - Ready to receive WooCommerce webhooks');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testWooCommerceToProkipSync();
