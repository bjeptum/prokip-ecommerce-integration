/**
 * Test WooCommerce webhook processing
 * This script simulates a WooCommerce order webhook to test the bidirectional sync
 */

const axios = require('axios');

const WEBHOOK_URL = 'http://localhost:3000/connections/webhook/woocommerce';

// Sample WooCommerce order data (what WooCommerce sends in webhook)
const sampleWooOrder = {
  id: 12345,
  number: '12345',
  status: 'completed',
  date_created: '2026-01-23T10:30:00',
  total: '99.99',
  discount_total: '10.00',
  customer_id: 678,
  billing: {
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com'
  },
  line_items: [
    {
      id: 1,
      name: 'Test Product',
      sku: 'TEST-SKU-001',
      quantity: 2,
      price: '54.995',
      total: '109.99',
      total_tax: '0.00'
    },
    {
      id: 2,
      name: 'Another Product',
      sku: 'TEST-SKU-002',
      quantity: 1,
      price: '0.00',
      total: '0.00',
      total_tax: '0.00'
    }
  ],
  _links: {
    self: [
      {
        href: 'https://your-store.com/wp-json/wc/v3/orders/12345'
      }
    ]
  }
};

async function testWebhook() {
  try {
    console.log('🧪 Testing WooCommerce webhook processing...');
    console.log('📦 Sample order data:', JSON.stringify(sampleWooOrder, null, 2));

    // Send webhook request
    const response = await axios.post(WEBHOOK_URL, sampleWooOrder, {
      headers: {
        'Content-Type': 'application/json',
        'X-WC-Webhook-Topic': 'order.created',
        'X-WC-Webhook-Source': 'https://your-store.com',
        'X-WC-Webhook-Signature': 'test-signature' // This will fail validation but that's ok for testing
      }
    });

    console.log('✅ Webhook sent successfully!');
    console.log('📬 Response status:', response.status);
    console.log('📬 Response data:', response.data);

    // Wait a bit for processing
    console.log('⏳ Waiting 5 seconds for webhook processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check the results by querying sync status
    const syncResponse = await axios.get('http://localhost:3000/sync/status');
    console.log('📊 Sync status:', JSON.stringify(syncResponse.data, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testWebhook();
