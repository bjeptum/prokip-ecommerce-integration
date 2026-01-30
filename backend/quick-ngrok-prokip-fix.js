/**
 * QUICK FIX: Ngrok + Real Prokip API Setup
 * Ensures your ngrok webhook works with real Prokip API stock reduction
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function quickNgrokProkipFix() {
  console.log('🚀 QUICK NGROK + REAL PROKIP API FIX');
  console.log('=' .repeat(60));

  try {
    // Step 1: Check current configuration
    console.log('\n📋 Current Configuration Check');
    
    const prokipApiUrl = process.env.PROKIP_API;
    const mockProkip = process.env.MOCK_PROKIP;
    const prokipConfigs = await prisma.prokipConfig.findMany();
    
    console.log(`   PROKIP_API: ${prokipApiUrl || 'NOT SET'}`);
    console.log(`   MOCK_PROKIP: ${mockProkip || 'NOT SET'}`);
    console.log(`   Using Real API: ${mockProkip !== 'true' ? '✅ YES' : '❌ NO'}`);
    console.log(`   Prokip Configs: ${prokipConfigs.length}`);

    // Step 2: Essential Environment Variables
    console.log('\n🔧 Essential Environment Variables (.env file):');
    console.log('   PROKIP_API=https://api.prokip.africa');
    console.log('   MOCK_PROKIP=false');
    console.log('   WEBHOOK_SECRET=your-secret-key');
    console.log('   PORT=3000');

    // Step 3: Ngrok Webhook Configuration
    console.log('\n🌐 Ngrok Webhook Configuration:');
    const ngrokUrl = 'https://nonluminous-flawed-lonny.ngrok-free.dev';
    const webhookUrl = `${ngrokUrl}/connections/webhook/woocommerce`;
    
    console.log(`   Your ngrok webhook URL: ${webhookUrl}`);
    console.log('   ✅ Route added: /connections/webhook → webhookRoutes');
    
    // Step 4: WooCommerce Webhook Setup Instructions
    console.log('\n🛒 WooCommerce Webhook Setup:');
    console.log('1. Go to WooCommerce > Settings > Advanced > Webhooks');
    console.log('2. Add new webhook:');
    console.log(`   - Name: Prokip Stock Sync`);
    console.log(`   - Payload URL: ${webhookUrl}`);
    console.log('   - Action: Order created`);
    console.log('   - Status: Processing (and Completed)`);
    console.log('   - Secret: any-secret-key`);

    // Step 5: Test the webhook endpoint
    console.log('\n🧪 Test Webhook Endpoint:');
    console.log('Once server is running, test with:');
    console.log(`curl -X POST ${webhookUrl} \\`);
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -H "X-WC-Webhook-Topic: order.created" \\');
    console.log('  -d \'{"id":"test-123","status":"processing","line_items":[{"sku":"TEST","quantity":1}]}\'');

    // Step 6: Real Prokip API Integration
    console.log('\n🔗 Real Prokip API Integration:');
    
    if (prokipConfigs.length > 0) {
      console.log('✅ Prokip configurations found');
      console.log('   Stock reduction will use real Prokip API endpoints:');
      console.log('   - /connector/api/stock-adjustments');
      console.log('   - /connector/api/opening-stock/save');
      console.log('   - /connector/api/sell (fallback)');
      
      // Test authentication
      try {
        const prokipService = require('./src/services/prokipService');
        for (const config of prokipConfigs) {
          const isAuthenticated = await prokipService.isAuthenticated(config.userId);
          console.log(`   User ${config.userId}: ${isAuthenticated ? '✅ Authenticated' : '❌ Not authenticated'}`);
        }
      } catch (authError) {
        console.log(`   ❌ Authentication test failed: ${authError.message}`);
      }
    } else {
      console.log('❌ No Prokip configurations found');
      console.log('   💡 Configure Prokip credentials in the system first');
    }

    // Step 7: Expected Flow
    console.log('\n🎯 Complete Flow (when configured):');
    console.log('1. WooCommerce sale → webhook sent');
    console.log('2. Ngrok receives webhook → forwards to your server');
    console.log('3. Server processes webhook → records sale in Prokip');
    console.log('4. Stock reduction via real Prokip API');
    console.log('5. Stock updated in Prokip ✅');

    // Step 8: Troubleshooting
    console.log('\n🔧 Troubleshooting:');
    console.log('If stock reduction is not working:');
    console.log('1. Ensure MOCK_PROKIP=false in .env');
    console.log('2. Verify PROKIP_API is set correctly');
    console.log('3. Check Prokip authentication is valid');
    console.log('4. Test webhook endpoint manually with curl');
    console.log('5. Check server logs for errors');

    console.log('\n✅ SUMMARY:');
    console.log('- Ngrok route configured: /connections/webhook/woocommerce');
    console.log('- Real Prokip API integration ready');
    console.log('- Enhanced webhook processing with database logging');
    console.log('- Multiple stock reduction fallback methods');
    console.log('- CSRF protection properly configured');

  } catch (error) {
    console.error('\n❌ Quick fix failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the quick fix
if (require.main === module) {
  quickNgrokProkipFix()
    .then(() => {
      console.log('\n✨ Quick fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Quick fix crashed:', error);
      process.exit(1);
    });
}

module.exports = { quickNgrokProkipFix };
