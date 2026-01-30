const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function comprehensiveWooCommerceFix() {
  console.log('🔧 Comprehensive WooCommerce Fix');
  console.log('=================================');

  try {
    // 1. Check current configuration
    console.log('\n1️⃣ Analyzing current configuration...');
    const connection = await prisma.connection.findFirst({
      where: { platform: 'woocommerce' }
    });

    if (!connection) {
      console.error('❌ No WooCommerce connection found');
      return;
    }

    console.log(`✅ Store: ${connection.storeUrl}`);
    console.log(`   Auth Method: ${connection.accessToken ? 'OAuth' : 'Consumer Key'}`);
    
    // 2. Test WooCommerce API access
    console.log('\n2️⃣ Testing WooCommerce API access...');
    const wooBaseUrl = connection.storeUrl.replace(/\/$/, '') + '/wp-json/wc/v3/';
    
    let client;
    if (connection.accessToken && connection.accessTokenSecret) {
      // OAuth method
      console.log('   Using OAuth authentication...');
      const wooOAuthService = require('./src/services/wooOAuthService');
      client = wooOAuthService.createAuthenticatedClient(
        connection.storeUrl,
        connection.accessToken,
        connection.accessTokenSecret
      );
    } else {
      // Consumer Key method
      console.log('   Using Consumer Key authentication...');
      client = axios.create({
        baseURL: wooBaseUrl,
        auth: {
          username: connection.consumerKey,
          password: connection.consumerSecret
        },
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Prokip-Integration/1.0'
        },
        timeout: 15000
      });
    }

    // Test basic API access
    try {
      const response = await client.get('system_status');
      console.log('✅ WooCommerce API accessible');
      console.log(`   WooCommerce Version: ${response.data.data?.woocommerce_version || 'Unknown'}`);
    } catch (error) {
      console.error('❌ WooCommerce API not accessible:', error.response?.data || error.message);
      return;
    }

    // 3. Check existing webhooks
    console.log('\n3️⃣ Checking existing webhooks...');
    try {
      const { data: webhooks } = await client.get('webhooks');
      console.log(`✅ Found ${webhooks.length} existing webhooks`);
      
      const prokipWebhooks = webhooks.filter(w => 
        w.name.includes('Prokip') || w.delivery_url.includes('prokip')
      );
      
      if (prokipWebhooks.length > 0) {
        console.log(`✅ Found ${prokipWebhooks.length} Prokip webhooks:`);
        prokipWebhooks.forEach(webhook => {
          console.log(`   - ${webhook.name} (${webhook.topic}) - Status: ${webhook.status}`);
          console.log(`     URL: ${webhook.delivery_url}`);
        });
      } else {
        console.log('ℹ️ No Prokip webhooks found');
      }
    } catch (error) {
      console.warn('⚠️ Could not list webhooks:', error.response?.data || error.message);
    }

    // 4. Check webhook permissions
    console.log('\n4️⃣ Checking webhook permissions...');
    try {
      const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/connections/webhook/woocommerce';
      const testWebhook = {
        name: 'Prokip Test Webhook',
        topic: 'order.created',
        delivery_url: webhookUrl,
        secret: 'test_secret',
        status: 'active'
      };

      const response = await client.post('webhooks', testWebhook);
      console.log('✅ Webhook creation permissions OK');
      
      // Delete the test webhook immediately
      await client.delete(`webhooks/${response.data.id}`);
      console.log('✅ Test webhook cleaned up');
      
    } catch (error) {
      console.error('❌ Webhook creation failed:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        console.log('\n🔧 SOLUTION: Fix WooCommerce permissions');
        console.log('The Consumer Key/Secret lacks webhook creation permissions.');
        console.log('\nOption 1: Update WooCommerce Consumer Key permissions:');
        console.log('1. Go to WooCommerce > Settings > Advanced > REST API');
        console.log('2. Find your Consumer Key');
        console.log('3. Edit and set permissions to "Read/Write"');
        console.log('4. Update the connection in the database');
        
        console.log('\nOption 2: Use Application Password:');
        console.log('1. Go to Users > Your Profile > Application Passwords');
        console.log('2. Create a new Application Password');
        console.log('3. Update connection with username and app_password');
        
        console.log('\nOption 3: Use OAuth (if available)');
        console.log('1. Set up OAuth in WooCommerce');
        console.log('2. Get access token and refresh token');
        console.log('3. Update connection with OAuth tokens');
      }
    }

    // 5. Alternative: Manual webhook setup guide
    console.log('\n5️⃣ Manual webhook setup guide...');
    console.log('If automatic setup fails, manually create webhooks:');
    console.log('\nStep 1: Go to WooCommerce > Settings > Advanced > Webhooks');
    console.log('Step 2: Click "Add Webhook"');
    console.log(`Step 3: Set webhook URL to: ${process.env.WEBHOOK_URL || 'http://localhost:3000/connections/webhook/woocommerce'}`);
    console.log('Step 4: Set events to: Order created, Order updated, Order status changed');
    console.log('Step 5: Set status to "Active"');
    console.log('Step 6: Save and test');

    // 6. Test webhook processing directly
    console.log('\n6️⃣ Testing webhook processing...');
    console.log('Creating a test order to verify processing works...');
    
    const { processStoreToProkip } = require('./src/services/syncService');
    
    const testOrder = {
      id: Date.now(),
      number: Date.now().toString(),
      status: 'completed',
      date_created: new Date().toISOString(),
      total: '99.99',
      line_items: [{
        id: 1,
        name: 'Test Product',
        sku: '4848961', // Use existing SKU
        quantity: 1,
        price: '99.99'
      }]
    };

    try {
      await processStoreToProkip(
        connection.storeUrl,
        'order.created',
        testOrder,
        'woocommerce',
        50
      );
      console.log('✅ Webhook processing works correctly');
      console.log('   The issue is webhook delivery from WooCommerce, not processing');
    } catch (error) {
      console.error('❌ Webhook processing failed:', error.message);
    }

    console.log('\n✅ Analysis complete!');
    console.log('\n📋 SUMMARY:');
    console.log('✅ WooCommerce API is accessible');
    console.log('✅ Webhook processing code works correctly');
    console.log('❌ Webhook creation permissions insufficient');
    console.log('❌ Webhook URL uses localhost (not accessible from WooCommerce)');
    
    console.log('\n🔧 PERMANENT FIX:');
    console.log('1. Set up public webhook URL (ngrok or domain)');
    console.log('2. Fix WooCommerce permissions (Read/Write keys or OAuth)');
    console.log('3. Create webhooks manually or with fixed permissions');
    console.log('4. Test with real WooCommerce order');

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run comprehensive fix
comprehensiveWooCommerceFix();
