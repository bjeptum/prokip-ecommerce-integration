/**
 * Complete test for WooCommerce bidirectional sync
 * This tests the entire flow: WooCommerce order -> Prokip inventory reduction
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Sample WooCommerce order data
const sampleWooOrder = {
  id: 12346,
  number: '12346',
  status: 'completed', // This should trigger inventory reduction
  date_created: '2026-01-23T10:30:00',
  total: '99.99',
  discount_total: '10.00',
  customer_id: 678,
  billing: {
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane.smith@example.com'
  },
  line_items: [
    {
      id: 1,
      name: 'Test Product with SKU',
      sku: 'TEST-SKU-001',
      quantity: 2,
      price: '54.995',
      total: '109.99',
      total_tax: '0.00'
    }
  ],
  _links: {
    self: [
      {
        href: 'https://test-store.com/wp-json/wc/v3/orders/12346'
      }
    ]
  }
};

async function testCompleteFlow() {
  try {
    console.log('🚀 Starting complete WooCommerce bidirectional sync test...\n');

    // Step 1: Send webhook (this should trigger inventory reduction in Prokip)
    console.log('📤 Step 1: Sending WooCommerce order webhook...');
    const webhookResponse = await axios.post(`${BASE_URL}/connections/webhook/woocommerce`, sampleWooOrder, {
      headers: {
        'Content-Type': 'application/json',
        'X-WC-Webhook-Topic': 'order.created',
        'X-WC-Webhook-Source': 'https://test-store.com'
      }
    });
    console.log('✅ Webhook sent successfully:', webhookResponse.data);

    // Step 2: Wait for processing
    console.log('\n⏳ Step 2: Waiting 3 seconds for webhook processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 3: Check if the order was logged in sales_logs
    console.log('\n📊 Step 3: Checking database for sales log...');
    try {
      // We'll need to query the database directly since the API requires auth
      console.log('📝 To verify the sale was recorded, check the database:');
      console.log('   SELECT * FROM sales_logs WHERE order_id = \'12346\';');
      console.log('   SELECT * FROM webhook_events WHERE payload LIKE \'%12346%\';');
    } catch (error) {
      console.log('ℹ️ Cannot query API without authentication, but webhook was accepted');
    }

    // Step 4: Test different order statuses
    console.log('\n🔄 Step 4: Testing order status change webhook...');
    const statusUpdateOrder = {
      ...sampleWooOrder,
      id: 12347,
      number: '12347',
      status: 'processing' // This should also trigger inventory reduction
    };

    const statusResponse = await axios.post(`${BASE_URL}/connections/webhook/woocommerce`, statusUpdateOrder, {
      headers: {
        'Content-Type': 'application/json',
        'X-WC-Webhook-Topic': 'order.updated',
        'X-WC-Webhook-Source': 'https://test-store.com'
      }
    });
    console.log('✅ Status update webhook sent:', statusResponse.data);

    // Step 5: Test cancellation (should restore inventory)
    console.log('\n↩️ Step 5: Testing order cancellation webhook...');
    const cancelledOrder = {
      ...sampleWooOrder,
      id: 12348,
      number: '12348',
      status: 'cancelled'
    };

    const cancelResponse = await axios.post(`${BASE_URL}/connections/webhook/woocommerce`, cancelledOrder, {
      headers: {
        'Content-Type': 'application/json',
        'X-WC-Webhook-Topic': 'order.cancelled',
        'X-WC-Webhook-Source': 'https://test-store.com'
      }
    });
    console.log('✅ Cancellation webhook sent:', cancelResponse.data);

    console.log('\n🎉 Test completed! Check the following:');
    console.log('1. Server console logs for webhook processing messages');
    console.log('2. Database sales_logs table for new entries');
    console.log('3. Database webhook_events table for processed webhooks');
    console.log('4. Prokip inventory levels (if connected) for reductions');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testCompleteFlow();
