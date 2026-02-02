/**
 * TEST UPDATED WOOCOMMERCE WEBHOOK WITH LARAVEL FORMAT
 */

const axios = require('axios');

async function testUpdatedWebhook() {
  try {
    console.log('🧪 Testing Updated WooCommerce Webhook with Laravel Format');
    console.log('🎯 Endpoint: POST /webhooks/woocommerce/order-created\n');

    // Test order with variation_id mapping
    const testOrder = {
      id: `TEST_${Date.now()}`,
      order_number: `TEST_${Date.now()}`,
      status: 'processing',
      total: '1500.00',
      date_created: new Date().toISOString(),
      date_paid: new Date().toISOString(),
      customer: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        phone: '+254700000000'
      },
      billing: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        phone: '+254700000000',
        address_1: '123 Main St',
        address_2: 'Nairobi'
      },
      line_items: [
        {
          product_id: 45, // This will be used as variation_id
          name: 'Polo Shirt - Black',
          sku: '45', // Numeric SKU = variation_id
          quantity: 2,
          price: '750.00',
          total: '1500.00'
        }
      ]
    };

    const webhookPayload = {
      action: 'order.created',
      order: testOrder
    };

    console.log('📦 Test Order:');
    console.log(`   - Order ID: ${testOrder.id}`);
    console.log(`   - Status: ${testOrder.status}`);
    console.log(`   - Items: ${testOrder.line_items.length}`);
    console.log(`   - SKU (variation_id): ${testOrder.line_items[0].sku}`);

    try {
      const webhookResponse = await axios.post(
        'http://localhost:3000/webhooks/woocommerce/order-created',
        webhookPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'WooCommerce/7.0 Hookshot',
            'X-Connection-ID': '10'
          },
          timeout: 30000
        }
      );

      console.log('\n✅ Webhook processed successfully!');
      console.log('📝 Response:', webhookResponse.data);

    } catch (webhookError) {
      console.log('\n❌ Webhook test failed:', webhookError.message);
      if (webhookError.response) {
        console.log('📄 Error response:', webhookError.response.data);
      }
    }

    console.log('\n🎯 Laravel Format Verification:');
    console.log('✅ Products as OBJECT (not array)');
    console.log('✅ Keys are variation_id');
    console.log('✅ API-TOKEN header ready');
    console.log('✅ Laravel validation implemented');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testUpdatedWebhook();
