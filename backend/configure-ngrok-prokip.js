/**
 * NGROK + REAL PROKIP API Configuration and Test
 * Ensures webhook works with ngrok and stock reduction uses real Prokip API
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function configureNgrokAndProkipAPI() {
  console.log('🚀 CONFIGURING NGROK + REAL PROKIP API INTEGRATION');
  console.log('=' .repeat(70));

  try {
    // Step 1: Verify ngrok webhook URL configuration
    console.log('\n📋 Step 1: Ngrok Webhook Configuration');
    
    const ngrokUrl = 'https://nonluminous-flawed-lonny.ngrok-free.dev';
    const webhookPath = '/connections/webhook/woocommerce';
    const fullWebhookUrl = ngrokUrl + webhookPath;
    
    console.log(`   Ngrok URL: ${ngrokUrl}`);
    console.log(`   Webhook Path: ${webhookPath}`);
    console.log(`   Full Webhook URL: ${fullWebhookUrl}`);
    
    // Test webhook endpoint availability
    try {
      const response = await axios.get(`${ngrokUrl}/health`, { timeout: 5000 });
      console.log(`   ✅ Server accessible via ngrok (status: ${response.status})`);
    } catch (error) {
      console.log(`   ❌ Server not accessible via ngrok: ${error.message}`);
      console.log('   💡 Make sure the server is running and ngrok is properly configured');
      return;
    }

    // Step 2: Check Prokip API configuration
    console.log('\n📋 Step 2: Real Prokip API Configuration');
    
    const prokipApiUrl = process.env.PROKIP_API;
    const mockProkip = process.env.MOCK_PROKIP;
    
    console.log(`   PROKIP_API: ${prokipApiUrl || 'NOT SET'}`);
    console.log(`   MOCK_PROKIP: ${mockProkip || 'NOT SET'}`);
    console.log(`   Using Real API: ${mockProkip !== 'true' ? '✅ YES' : '❌ NO (using mock)'}`);
    
    if (!prokipApiUrl) {
      console.log('   ❌ PROKIP_API environment variable not set');
      console.log('   💡 Set it in your .env file: PROKIP_API=https://api.prokip.africa');
    }
    
    if (mockProkip === 'true') {
      console.log('   ⚠️ MOCK_PROKIP is enabled - stock changes will be local only');
      console.log('   💡 Set MOCK_PROKIP=false to use real Prokip API');
    }

    // Step 3: Check Prokip authentication
    console.log('\n📋 Step 3: Prokip Authentication Status');
    
    const prokipConfigs = await prisma.prokipConfig.findMany();
    console.log(`   Prokip configurations: ${prokipConfigs.length}`);
    
    for (const config of prokipConfigs) {
      console.log(`   - User ${config.userId}: Location ${config.locationId}`);
      console.log(`     API URL: ${config.apiUrl}`);
      console.log(`     Token expires: ${config.expiresAt}`);
      
      // Test authentication
      try {
        const prokipService = require('./src/services/prokipService');
        const isAuthenticated = await prokipService.isAuthenticated(config.userId);
        console.log(`     Authenticated: ${isAuthenticated ? '✅' : '❌'}`);
        
        if (isAuthenticated) {
          // Test getting products from real API
          try {
            const products = await prokipService.getProducts(config.locationId, config.userId);
            console.log(`     Real API products: ${products.length}`);
            
            if (products.length > 0) {
              const sampleProduct = products[0];
              console.log(`     Sample product: ${sampleProduct.name} (SKU: ${sampleProduct.sku})`);
              console.log(`     Current stock: ${sampleProduct.stock || sampleProduct.qty_available || 'N/A'}`);
            }
          } catch (productsError) {
            console.log(`     ❌ Failed to get products from real API: ${productsError.message}`);
          }
        }
      } catch (authError) {
        console.log(`     ❌ Authentication test failed: ${authError.message}`);
      }
    }

    // Step 4: Test webhook with ngrok URL
    console.log('\n📋 Step 4: Testing Webhook via Ngrok');
    
    const testOrder = {
      id: `NGROK-TEST-${Date.now()}`,
      number: `WC-NGROK-${Date.now()}`,
      status: 'processing',
      date_created: new Date().toISOString(),
      total: '199.99',
      customer: {
        first_name: 'Ngrok Test',
        email: 'test@ngrok.example.com'
      },
      billing: {
        first_name: 'Ngrok Test',
        email: 'test@ngrok.example.com'
      },
      line_items: [
        {
          id: 1,
          sku: 'NGROK-TEST-SKU',
          name: 'Ngrok Test Product',
          quantity: 3,
          price: '66.66'
        }
      ]
    };

    console.log('📦 Sending test webhook via ngrok...');
    console.log(`   Order ID: ${testOrder.id}`);
    console.log(`   Webhook URL: ${fullWebhookUrl}`);

    try {
      const response = await axios.post(fullWebhookUrl, testOrder, {
        headers: {
          'Content-Type': 'application/json',
          'X-WC-Webhook-Topic': 'order.created',
          'X-WC-Webhook-Source': 'https://test-woocommerce.example.com'
        },
        timeout: 15000
      });

      if (response.status === 200) {
        console.log('✅ Webhook sent successfully via ngrok');
      } else {
        console.log(`⚠️ Webhook response: ${response.status}`);
      }
    } catch (webhookError) {
      console.log('❌ Webhook test failed:', webhookError.message);
      if (webhookError.code === 'ECONNREFUSED') {
        console.log('💡 Check if server is running and ngrok is active');
      }
    }

    // Step 5: Wait for processing and check results
    console.log('\n📋 Step 5: Checking Processing Results');
    
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for async processing
    
    // Check webhook events
    const webhookEvents = await prisma.webhookEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    const ngrokWebhook = webhookEvents.find(event => 
      event.payload.includes(testOrder.id)
    );

    if (ngrokWebhook) {
      console.log(`✅ Ngrok webhook received and stored`);
      console.log(`   Event ID: ${ngrokWebhook.id}`);
      console.log(`   Processed: ${ngrokWebhook.processed}`);
    } else {
      console.log('❌ Ngrok webhook not found in database');
    }

    // Check sales logs
    const salesLogs = await prisma.salesLog.findMany({
      orderBy: { syncedAt: 'desc' },
      take: 5
    });

    const ngrokSale = salesLogs.find(sale => 
      sale.orderId === testOrder.id.toString()
    );

    if (ngrokSale) {
      console.log(`✅ Sale created from ngrok webhook`);
      console.log(`   Sale ID: ${ngrokSale.id}`);
      console.log(`   Stock Deducted: ${ngrokSale.stockDeducted ? 'YES' : 'NO'}`);
      console.log(`   Platform: ${ngrokSale.platform}`);
    } else {
      console.log('❌ No sale created from ngrok webhook');
    }

    // Step 6: Configuration Recommendations
    console.log('\n📋 Step 6: Configuration Recommendations');
    console.log('=' .repeat(70));
    
    console.log('\n🎯 WOOCOMMERCE WEBHOOK CONFIGURATION:');
    console.log('Update your WooCommerce webhooks to use:');
    console.log(`   Payload URL: ${fullWebhookUrl}`);
    console.log('   Topics: order.created, order.updated');
    console.log('   Status: Processing (and/or Completed)');
    
    console.log('\n🔧 ENVIRONMENT VARIABLES (.env file):');
    console.log('   PROKIP_API=https://api.prokip.africa');
    console.log('   MOCK_PROKIP=false');
    console.log('   WEBHOOK_SECRET=your-woocommerce-webhook-secret');
    
    console.log('\n🚀 EXPECTED FLOW:');
    console.log('WooCommerce Sale → Ngrok Webhook → Server → Real Prokip API → Stock Reduced ✅');
    
    console.log('\n📊 CURRENT STATUS:');
    const webhookWorking = !!ngrokWebhook;
    const saleWorking = !!ngrokSale;
    const stockWorking = ngrokSale?.stockDeducted || false;
    const apiWorking = prokipConfigs.length > 0 && process.env.MOCK_PROKIP !== 'true';
    
    console.log(`   Ngrok Webhook: ${webhookWorking ? '✅' : '❌'}`);
    console.log(`   Sale Creation: ${saleWorking ? '✅' : '❌'}`);
    console.log(`   Stock Reduction: ${stockWorking ? '✅' : '❌'}`);
    console.log(`   Real Prokip API: ${apiWorking ? '✅' : '❌'}`);
    
    if (webhookWorking && saleWorking && stockWorking && apiWorking) {
      console.log('\n🎉 SUCCESS: Complete integration is working!');
      console.log('✅ WooCommerce sales will reduce stock in real Prokip API via ngrok');
    } else {
      console.log('\n⚠️ CONFIGURATION NEEDED:');
      
      if (!webhookWorking) {
        console.log('❌ Ngrok webhook not working - check server and ngrok configuration');
      }
      
      if (!saleWorking) {
        console.log('❌ Sale creation failing - check webhook processing and database');
      }
      
      if (!stockWorking) {
        console.log('❌ Stock reduction failing - check Prokip authentication and API endpoints');
      }
      
      if (!apiWorking) {
        console.log('❌ Real Prokip API not configured - set environment variables');
      }
    }

  } catch (error) {
    console.error('\n❌ Configuration failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the configuration
if (require.main === module) {
  configureNgrokAndProkipAPI()
    .then(() => {
      console.log('\n✨ Ngrok + Prokip API configuration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Configuration crashed:', error);
      process.exit(1);
    });
}

module.exports = { configureNgrokAndProkipAPI };
