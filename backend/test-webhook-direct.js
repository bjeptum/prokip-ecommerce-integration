const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function createTestWooCommerceWebhook() {
  console.log('🧪 Creating Test WooCommerce Webhook Event');
  console.log('=========================================');

  try {
    // 1. Get WooCommerce connection
    console.log('\n1️⃣ Getting WooCommerce connection...');
    const connection = await prisma.connection.findFirst({
      where: { platform: 'woocommerce' }
    });

    if (!connection) {
      console.error('❌ No WooCommerce connection found');
      return;
    }

    console.log(`✅ Found connection: ${connection.storeUrl}`);

    // 2. Create a mock WooCommerce order payload
    console.log('\n2️⃣ Creating mock WooCommerce order...');
    const mockOrder = {
      id: 14251,
      number: '14251',
      status: 'completed',
      date_created: '2025-01-28T10:45:00',
      total: '125.50',
      discount_total: '5.00',
      total_tax: '12.55',
      customer: {
        first_name: 'Test',
        email: 'test@example.com'
      },
      billing: {
        first_name: 'Test',
        email: 'test@example.com'
      },
      line_items: [
        {
          id: 1,
          name: 'Hair cream',
          sku: '4848961',
          quantity: 1,
          price: '62.75',
          total_tax: '6.28'
        },
        {
          id: 2,
          name: 'Claire Wash',
          sku: '4815445',
          quantity: 1,
          price: '57.75',
          total_tax: '5.78'
        }
      ]
    };

    console.log(`   Order ID: ${mockOrder.id}`);
    console.log(`   Status: ${mockOrder.status}`);
    console.log(`   Items: ${mockOrder.line_items.length}`);

    // 3. Process the webhook directly (simulating webhook receipt)
    console.log('\n3️⃣ Processing webhook directly...');
    
    // Import the sync service
    const { processStoreToProkip } = require('./src/services/syncService');
    
    try {
      await processStoreToProkip(
        connection.storeUrl,
        'order.created',
        mockOrder,
        'woocommerce',
        50 // userId
      );
      console.log('✅ Webhook processed successfully');
    } catch (error) {
      console.error('❌ Webhook processing failed:', error.message);
      console.error('Stack:', error.stack);
    }

    // 4. Check results
    console.log('\n4️⃣ Checking results...');
    
    // Check sales log
    const salesLog = await prisma.salesLog.findFirst({
      where: { orderId: mockOrder.id.toString() }
    });

    if (salesLog) {
      console.log(`✅ Sales log created:`);
      console.log(`   Order ID: ${salesLog.orderId}`);
      console.log(`   Platform: ${salesLog.platform}`);
      console.log(`   Status: ${salesLog.status}`);
      console.log(`   Stock Deducted: ${salesLog.stockDeducted}`);
      console.log(`   Prokip Sell ID: ${salesLog.prokipSellId || 'Not returned'}`);
    } else {
      console.log('❌ No sales log created');
    }

    // Check inventory changes
    console.log('\n5️⃣ Checking inventory changes...');
    for (const item of mockOrder.line_items) {
      if (item.sku) {
        const inventoryLog = await prisma.inventoryLog.findFirst({
          where: { sku: item.sku }
        });

        if (inventoryLog) {
          console.log(`   SKU ${item.sku}: ${inventoryLog.quantity} units`);
        } else {
          console.log(`   SKU ${item.sku}: No inventory record`);
        }
      }
    }

    console.log('\n✅ Test webhook completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run test
createTestWooCommerceWebhook();
