/**
 * Verify the complete WooCommerce webhook setup
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const WEBHOOK_URL = 'http://localhost:3000/connections/webhook/woocommerce';

async function verifySetup() {
  console.log('🔍 Verifying WooCommerce webhook setup...\n');

  // Step 1: Check if server is running
  try {
    const response = await axios.get('http://localhost:3000/sync/status', { timeout: 5000 });
    console.log('✅ Server is running on port 3000');
  } catch (error) {
    console.log('❌ Server is not running or not accessible');
    console.log('   Please start the server: npm start');
    return;
  }

  // Step 2: Test webhook endpoint
  try {
    const testWebhook = {
      id: 'test-' + Date.now(),
      status: 'completed',
      line_items: [{ sku: 'TEST', quantity: 1, price: '10.00' }],
      _links: { self: [{ href: 'https://learn.prokip.africa/test' }] }
    };

    const response = await axios.post(WEBHOOK_URL, testWebhook, {
      headers: {
        'Content-Type': 'application/json',
        'X-WC-Webhook-Topic': 'order.created',
        'X-WC-Webhook-Source': 'https://learn.prokip.africa'
      }
    });
    console.log('✅ Webhook endpoint is accessible');
  } catch (error) {
    console.log('❌ Webhook endpoint not accessible');
    console.log('   Error:', error.message);
    return;
  }

  // Step 3: Check database connection
  try {
    const prisma = new PrismaClient();
    await prisma.$connect();
    console.log('✅ Database connection is working');
    
    // Check WooCommerce connection
    const wooConn = await prisma.connection.findFirst({
      where: { platform: 'woocommerce' }
    });
    
    if (wooConn) {
      console.log(`✅ WooCommerce connection found: ${wooConn.storeUrl}`);
      console.log(`   Sync enabled: ${wooConn.syncEnabled}`);
    } else {
      console.log('❌ No WooCommerce connection found in database');
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.log('❌ Database connection failed');
    console.log('   Error:', error.message);
    return;
  }

  // Step 4: Summary and next steps
  console.log('\n📋 Setup Summary:');
  console.log('✅ Server is running');
  console.log('✅ Webhook endpoint is working');
  console.log('✅ Database connection is working');
  
  console.log('\n🎯 Next Steps:');
  console.log('1. Go to your WooCommerce admin panel');
  console.log('2. Navigate to: WooCommerce → Settings → Advanced → Webhooks');
  console.log('3. Create webhooks with these settings:');
  console.log('   - Topic: Order created');
  console.log('   - Delivery URL: http://localhost:3000/connections/webhook/woocommerce');
  console.log('   - Secret: prokip_secret');
  console.log('4. Test by creating a completed order in WooCommerce');
  console.log('5. Run: node check-webhooks.js to verify webhooks are received');

  console.log('\n📞 Quick Test Commands:');
  console.log('- Test webhook: node test-webhook-endpoint.js');
  console.log('- Check webhooks: node check-webhooks.js');
  console.log('- Verify setup: node verify-setup.js');
}

verifySetup().catch(console.error);
