const { PrismaClient } = require('@prisma/client');
const { registerWooWebhooks } = require('./src/services/wooService');

const prisma = new PrismaClient();

async function fixWooCommerceWebhooks() {
  console.log('🔧 Fixing WooCommerce Webhook Configuration');
  console.log('==========================================');

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
    console.log(`   Consumer Key: ${connection.consumerKey ? 'Present' : 'Missing'}`);
    console.log(`   Consumer Secret: ${connection.consumerSecret ? 'Present' : 'Missing'}`);
    console.log(`   Access Token: ${connection.accessToken ? 'Present' : 'Missing'}`);
    console.log(`   Access Token Secret: ${connection.accessTokenSecret ? 'Present' : 'Missing'}`);

    // 2. Determine authentication method
    let authMethod = 'consumer_key';
    if (connection.accessToken && connection.accessTokenSecret) {
      authMethod = 'oauth';
    } else if (connection.username && connection.appPassword) {
      authMethod = 'app_password';
    }

    console.log(`   Auth Method: ${authMethod}`);

    // 3. Register webhooks with proper authentication
    console.log('\n2️⃣ Registering webhooks...');
    
    try {
      await registerWooWebhooks(
        connection.storeUrl,
        connection.consumerKey,
        connection.consumerSecret,
        connection.accessToken,
        connection.accessTokenSecret,
        connection.username,
        connection.appPassword
      );
      console.log('✅ Webhooks registered successfully');
    } catch (error) {
      console.error('❌ Webhook registration failed:', error.message);
      
      // Try with alternative authentication
      if (authMethod === 'consumer_key' && connection.consumerKey && connection.consumerSecret) {
        console.log('\n🔄 Trying with consumer key authentication...');
        try {
          await registerWooWebhooks(
            connection.storeUrl,
            connection.consumerKey,
            connection.consumerSecret
          );
          console.log('✅ Webhooks registered with consumer key');
        } catch (error2) {
          console.error('❌ Consumer key auth also failed:', error2.message);
        }
      }
    }

    // 4. Test webhook endpoint accessibility from external
    console.log('\n3️⃣ Testing webhook URL accessibility...');
    const webhookUrl = process.env.WEBHOOK_URL || `http://localhost:${process.env.PORT || 3000}/connections/webhook/woocommerce`;
    console.log(`   Webhook URL: ${webhookUrl}`);
    
    // Check if using localhost (won't work from external WooCommerce)
    if (webhookUrl.includes('localhost') || webhookUrl.includes('127.0.0.1')) {
      console.log('⚠️ WARNING: Webhook URL uses localhost - WooCommerce cannot reach this!');
      console.log('   You need to use a public URL or tunnel (ngrok, localtunnel, etc.)');
      
      // Suggest ngrok setup
      console.log('\n💡 Quick fix with ngrok:');
      console.log('   1. Install ngrok: npm install -g ngrok');
      console.log('   2. Run: ngrok http 3000');
      console.log('   3. Update WEBHOOK_URL in .env to the ngrok URL');
      console.log('   4. Restart the server');
    } else {
      console.log('✅ Webhook URL appears to be public');
    }

    // 5. Create a test webhook event
    console.log('\n4️⃣ Creating test webhook event...');
    await prisma.webhookEvent.create({
      data: {
        topic: 'order.created',
        storeUrl: connection.storeUrl,
        payload: JSON.stringify({
          id: 'TEST-' + Date.now(),
          status: 'completed',
          total: '100.00',
          line_items: [{
            sku: 'TEST-SKU',
            quantity: 1,
            price: '100.00'
          }]
        }),
        processed: false
      }
    });
    console.log('✅ Test webhook event created');

    console.log('\n✅ Webhook fix completed!');
    console.log('\n📋 Next steps:');
    console.log('1. If using localhost, set up ngrok or public URL');
    console.log('2. Update WEBHOOK_URL in .env');
    console.log('3. Restart the server');
    console.log('4. Test by creating a new order in WooCommerce');

  } catch (error) {
    console.error('❌ Fix failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run fix
fixWooCommerceWebhooks();
