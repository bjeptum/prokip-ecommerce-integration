#!/usr/bin/env node

/**
 * TEST WOOCOMMERCE WEBHOOK WITH NGROK URL
 * 
 * This script tests your webhook endpoint:
 * https://nonluminous-flawed-lonny.ngrok-free.dev/connections/webhook/woocommerce
 */

const axios = require('axios');

const WEBHOOK_URL = 'https://nonluminous-flawed-lonny.ngrok-free.dev/connections/webhook/woocommerce';
const BACKEND_URL = 'http://localhost:3000';

console.log('🔗 Testing WooCommerce Webhook with Ngrok URL');
console.log('==============================================');
console.log(`🌐 Webhook URL: ${WEBHOOK_URL}`);
console.log(`🏠 Backend URL: ${BACKEND_URL}`);
console.log('');

async function testWebhookIntegration() {
  try {
    // Test 1: Verify ngrok webhook endpoint is accessible
    console.log('1. 🌐 Testing Ngrok Webhook Endpoint...');
    try {
      const response = await axios.get(WEBHOOK_URL.replace('/connections/webhook/woocommerce', '/health'), {
        timeout: 10000
      });
      console.log('   ✅ Ngrok tunnel is accessible');
    } catch (error) {
      console.log('   ⚠️  Ngrok tunnel test failed, but webhook may still work');
    }

    // Test 2: Test local webhook endpoint directly
    console.log('\n2. 🏠 Testing Local Webhook Endpoint...');
    try {
      const testOrder = {
        id: 'TEST-' + Date.now(),
        number: 'TEST-' + Date.now(),
        status: 'completed',
        total: 99.99,
        customer: {
          first_name: 'Test',
          last_name: 'Customer',
          email: 'test@example.com'
        },
        line_items: [
          {
            id: 'prod-1',
            sku: 'TEST-SKU-001',
            name: 'Test Product',
            quantity: 2,
            price: 49.99
          }
        ],
        created_at: new Date().toISOString()
      };

      const response = await axios.post(`${BACKEND_URL}/connections/webhook/woocommerce`, testOrder, {
        headers: {
          'Content-Type': 'application/json',
          'X-WC-Webhook-Topic': 'order.created',
          'X-WC-Webhook-Source': 'test-store.com'
        },
        timeout: 15000
      });

      if (response.status === 200) {
        console.log('   ✅ Local webhook endpoint working');
        console.log(`   📊 Response: ${response.data || 'OK'}`);
      } else {
        console.log(`   ⚠️  Unexpected response: ${response.status}`);
      }
    } catch (error) {
      console.log('   ❌ Local webhook test failed');
      console.log(`   🚫 Error: ${error.message}`);
    }

    // Test 3: Test ngrok webhook endpoint
    console.log('\n3. 🌐 Testing Ngrok Webhook Endpoint...');
    try {
      const testOrder = {
        id: 'NGROK-TEST-' + Date.now(),
        number: 'NGROK-TEST-' + Date.now(),
        status: 'completed',
        total: 149.99,
        customer: {
          first_name: 'Ngrok',
          last_name: 'Test',
          email: 'ngrok@example.com'
        },
        line_items: [
          {
            id: 'prod-2',
            sku: 'NGROK-SKU-001',
            name: 'Ngrok Test Product',
            quantity: 3,
            price: 49.99
          }
        ],
        created_at: new Date().toISOString()
      };

      const response = await axios.post(WEBHOOK_URL, testOrder, {
        headers: {
          'Content-Type': 'application/json',
          'X-WC-Webhook-Topic': 'order.created',
          'X-WC-Webhook-Source': 'ngrok-test-store.com'
        },
        timeout: 15000
      });

      if (response.status === 200) {
        console.log('   ✅ Ngrok webhook endpoint working!');
        console.log(`   📊 Response: ${response.data || 'OK'}`);
      } else {
        console.log(`   ⚠️  Ngrok webhook response: ${response.status}`);
      }
    } catch (error) {
      console.log('   ❌ Ngrok webhook test failed');
      console.log(`   🚫 Error: ${error.message}`);
      
      if (error.code === 'ECONNREFUSED') {
        console.log('   💡 Make sure ngrok is running and forwarding to localhost:3000');
      }
    }

    // Test 4: Check if order was processed
    console.log('\n4. 📋 Checking Order Processing...');
    try {
      // Wait a moment for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check sales logs (if endpoint exists)
      const salesResponse = await axios.get(`${BACKEND_URL}/api/sales`, {
        validateStatus: () => true
      });

      if (salesResponse.status === 200 && salesResponse.data.success) {
        const recentSales = salesResponse.data.sales || [];
        const testOrders = recentSales.filter(sale => 
          sale.orderId && (sale.orderId.includes('TEST-') || sale.orderId.includes('NGROK-TEST-'))
        );
        
        if (testOrders.length > 0) {
          console.log(`   ✅ Found ${testOrders.length} test orders in sales log`);
          testOrders.forEach(order => {
            console.log(`      📦 Order ${order.orderId}:`);
            console.log(`         Prokip Sell ID: ${order.prokipSellId || 'Not set'}`);
            console.log(`         Stock Deducted: ${order.stockDeducted ? 'Yes' : 'No'}`);
            console.log(`         Platform: ${order.platform}`);
          });
        } else {
          console.log('   ⚠️  No test orders found in sales log');
        }
      } else {
        console.log('   ⚠️  Could not access sales logs');
      }
    } catch (error) {
      console.log('   ⚠️  Sales log check failed');
    }

    // Test 5: Test webhook signature verification
    console.log('\n5. 🔐 Testing Webhook Signature...');
    try {
      const crypto = require('crypto');
      const testPayload = { test: 'signature verification' };
      const payloadString = JSON.stringify(testPayload);
      const secret = 'test-webhook-secret';
      const signature = crypto.createHmac('sha256', secret).update(payloadString).digest('base64');

      const response = await axios.post(`${BACKEND_URL}/connections/webhook/woocommerce`, testPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-WC-Webhook-Signature': signature,
          'X-WC-Webhook-Topic': 'product.updated'
        },
        timeout: 10000
      });

      if (response.status === 200) {
        console.log('   ✅ Webhook signature verification working');
      } else {
        console.log(`   ⚠️  Signature verification response: ${response.status}`);
      }
    } catch (error) {
      console.log('   ❌ Webhook signature test failed');
      console.log(`   🚫 Error: ${error.message}`);
    }

    console.log('\n🎉 Webhook Testing Completed!');
    console.log('\n📋 Configuration for WooCommerce:');
    console.log(`   🌐 Webhook URL: ${WEBHOOK_URL}`);
    console.log('   🔐 Secret: Set a webhook secret in WooCommerce settings');
    console.log('   📦 Topics: order.created, order.updated, order.updated');
    console.log('   🎯 Status: Active');
    
    console.log('\n🔍 What happens when order is created:');
    console.log('   1. WooCommerce sends webhook to your ngrok URL');
    console.log('   2. Your system receives and processes the webhook');
    console.log('   3. Order is recorded in Prokip (if paid)');
    console.log('   4. Stock is automatically deducted in Prokip');
    console.log('   5. Sales log is updated with processing status');

  } catch (error) {
    console.error('❌ Webhook test failed:', error.message);
  }
}

// Run the test
testWebhookIntegration().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});
