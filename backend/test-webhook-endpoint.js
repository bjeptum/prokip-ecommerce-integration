/**
 * Test the webhook endpoint directly to ensure it's working
 */

const axios = require('axios');

const WEBHOOK_URL = 'http://localhost:3000/connections/webhook/woocommerce';

// Create a realistic WooCommerce order that should match your store
const testOrder = {
  id: 99999,
  number: '99999',
  status: 'completed', // This should trigger inventory reduction
  date_created: '2026-01-23T10:30:00',
  total: '29.99',
  discount_total: '0.00',
  customer_id: 1,
  billing: {
    first_name: 'Test',
    last_name: 'Customer',
    email: 'test@example.com'
  },
  line_items: [
    {
      id: 1,
      name: 'Test Product',
      sku: 'TEST-PRODUCT', // Make sure this SKU exists in your Prokip
      quantity: 1,
      price: '29.99',
      total: '29.99',
      total_tax: '0.00'
    }
  ],
  _links: {
    self: [
      {
        href: 'https://learn.prokip.africa/wp-json/wc/v3/orders/99999'
      }
    ]
  }
};

async function testWebhookEndpoint() {
  try {
    console.log('🧪 Testing WooCommerce webhook endpoint...\n');
    console.log('📦 Test order data:');
    console.log(`- Order ID: ${testOrder.id}`);
    console.log(`- Status: ${testOrder.status}`);
    console.log(`- Total: ${testOrder.total}`);
    console.log(`- SKU: ${testOrder.line_items[0].sku}`);
    console.log(`- Store URL: https://learn.prokip.africa`);

    // Send webhook
    console.log('\n📤 Sending webhook...');
    const response = await axios.post(WEBHOOK_URL, testOrder, {
      headers: {
        'Content-Type': 'application/json',
        'X-WC-Webhook-Topic': 'order.created',
        'X-WC-Webhook-Source': 'https://learn.prokip.africa',
        'X-WC-Webhook-Signature': 'test-signature'
      },
      timeout: 10000
    });

    console.log('✅ Webhook sent successfully!');
    console.log(`Status: ${response.status}`);
    console.log(`Response: ${response.data}`);

    // Wait for processing
    console.log('\n⏳ Waiting 5 seconds for processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check if webhook was processed
    console.log('\n🔍 Checking if webhook was processed...');
    
    // Try to check webhook events (this might fail due to schema mismatch, but let's try)
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      const webhooks = await prisma.$queryRaw`
        SELECT * FROM webhook_events 
        WHERE created_at > NOW() - INTERVAL '1 minute'
        ORDER BY created_at DESC
        LIMIT 5
      `;
      
      console.log(`📊 Found ${webhooks.length} recent webhook events:`);
      webhooks.forEach(webhook => {
        console.log(`- ${webhook.created_at}: ${webhook.event_type} (processed: ${webhook.processed})`);
        if (webhook.error_message) {
          console.log(`  ❌ Error: ${webhook.error_message}`);
        }
      });
      
      await prisma.$disconnect();
    } catch (dbError) {
      console.log('❌ Could not check database (expected due to schema issues)');
    }

    console.log('\n🎯 Next steps:');
    console.log('1. If webhook was accepted, the issue is likely in WooCommerce webhook configuration');
    console.log('2. Check your WooCommerce admin panel for webhook settings');
    console.log('3. Ensure the webhook URL points to: http://localhost:3000/connections/webhook/woocommerce');
    console.log('4. Make sure webhook is triggered for "Order created" and "Order updated" events');

  } catch (error) {
    console.error('❌ Webhook test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testWebhookEndpoint();
