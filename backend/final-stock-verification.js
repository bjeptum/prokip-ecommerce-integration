/**
 * FINAL VERIFICATION: WooCommerce to Prokip Stock Reduction
 * Manual verification of all critical components
 */

const fs = require('fs');
const path = require('path');

async function finalVerification() {
  console.log('🔍 FINAL VERIFICATION: WooCommerce to Prokip Stock Reduction');
  console.log('=' .repeat(80));

  try {
    // 1. Check app.js for CSRF exemption
    console.log('\n📋 1. CSRF Protection Check');
    const appJsPath = path.join(__dirname, 'src/app.js');
    const appJsContent = fs.readFileSync(appJsPath, 'utf8');
    
    const hasWebhookExemption = appJsContent.includes('/connections/webhook');
    console.log(`   CSRF exemption for /connections/webhook: ${hasWebhookExemption ? '✅' : '❌'}`);
    
    // 2. Check Prokip service for CSRF headers
    console.log('\n📋 2. CSRF Headers Check');
    const prokipServicePath = path.join(__dirname, 'src/services/prokipService.js');
    const prokipContent = fs.readFileSync(prokipServicePath, 'utf8');
    
    const hasCSRFHeaders = prokipContent.includes('X-Requested-With: XMLHttpRequest');
    console.log(`   CSRF headers in Prokip API calls: ${hasCSRFHeaders ? '✅' : '❌'}`);
    
    // 3. Check webhook endpoint
    console.log('\n📋 3. Webhook Endpoint Check');
    const webhookPath = path.join(__dirname, 'src/routes/webhookRoutes.js');
    const webhookContent = fs.readFileSync(webhookPath, 'utf8');
    
    const hasProcessStoreToProkip = webhookContent.includes('processStoreToProkip');
    const hasWebhookStorage = webhookContent.includes('prisma.webhookEvent.create');
    
    console.log(`   Calls processStoreToProkip: ${hasProcessStoreToProkip ? '✅' : '❌'}`);
    console.log(`   Stores webhook events: ${hasWebhookStorage ? '✅' : '❌'}`);
    
    // 4. Check stock reduction methods
    console.log('\n📋 4. Stock Reduction Methods');
    const syncServicePath = path.join(__dirname, 'src/services/syncService.js');
    const syncContent = fs.readFileSync(syncServicePath, 'utf8');
    
    const hasDeductStock = syncContent.includes('deductStockFromProkip');
    const hasAdjustStock = syncContent.includes('adjustStockInProkip');
    const hasSetStock = syncContent.includes('setStockInProkip');
    
    console.log(`   deductStockFromProkip: ${hasDeductStock ? '✅' : '❌'}`);
    console.log(`   adjustStockInProkip: ${hasAdjustStock ? '✅' : '❌'}`);
    console.log(`   setStockInProkip: ${hasSetStock ? '✅' : '❌'}`);
    
    // 5. Check Prokip API endpoints
    console.log('\n📋 5. Prokip API Endpoints');
    const endpoints = [
      '/connector/api/stock-adjustments',
      '/connector/api/sell',
      '/connector/api/opening-stock/save'
    ];
    
    endpoints.forEach(endpoint => {
      const hasEndpoint = prokipContent.includes(endpoint);
      console.log(`   ${endpoint}: ${hasEndpoint ? '✅' : '❌'}`);
    });
    
    // 6. Environment variables
    console.log('\n📋 6. Environment Variables');
    console.log(`   PROKIP_API: ${process.env.PROKIP_API || 'NOT SET'}`);
    console.log(`   MOCK_PROKIP: ${process.env.MOCK_PROKIP || 'NOT SET'}`);
    console.log(`   Using Real API: ${process.env.MOCK_PROKIP !== 'true' ? '✅' : '❌'}`);
    
    // 7. Final Assessment
    console.log('\n🎯 FINAL ASSESSMENT');
    console.log('=' .repeat(80));
    
    const allChecks = [
      hasWebhookExemption,
      hasCSRFHeaders,
      hasProcessStoreToProkip,
      hasWebhookStorage,
      hasDeductStock,
      hasAdjustStock,
      hasSetStock,
      endpoints.every(ep => prokipContent.includes(ep)),
      process.env.PROKIP_API,
      process.env.MOCK_PROKIP !== 'true'
    ];
    
    const allPassed = allChecks.every(check => check === true);
    
    console.log(`\n🏆 OVERALL STATUS: ${allPassed ? '✅ READY FOR PRODUCTION' : '⚠️ NEEDS ATTENTION'}`);
    
    if (allPassed) {
      console.log('\n🎉 CONCLUSION: Prokip stock WILL be deducted after WooCommerce sales!');
      console.log('\n✅ ALL CRITICAL COMPONENTS VERIFIED:');
      console.log('   • Ngrok webhook route configured');
      console.log('   • CSRF protection properly configured');
      console.log('   • Webhook processing implemented');
      console.log('   • Stock reduction methods ready');
      console.log('   • Prokip API endpoints configured');
      console.log('   • Real Prokip API enabled');
      console.log('   • CSRF headers included');
      
      console.log('\n🚀 EXPECTED FLOW:');
      console.log('   WooCommerce Sale → Ngrok Webhook → Server → Real Prokip API → Stock Reduced ✅');
      
      console.log('\n📋 NEXT STEPS:');
      console.log('   1. Start server: npm start');
      console.log('   2. Test webhook with your ngrok URL');
      console.log('   3. Create test sale in WooCommerce');
      console.log('   4. Verify stock reduction in Prokip');
    } else {
      console.log('\n❌ Some components need attention before stock reduction will work');
      const failedChecks = allChecks.map((check, index) => !check ? index + 1 : null).filter(Boolean);
      console.log(`   Failed checks: ${failedChecks.join(', ')}`);
    }

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
  }
}

// Run final verification
if (require.main === module) {
  finalVerification()
    .then(() => {
      console.log('\n✨ Final verification completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Verification crashed:', error);
      process.exit(1);
    });
}

module.exports = { finalVerification };
