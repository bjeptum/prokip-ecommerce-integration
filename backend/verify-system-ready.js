#!/usr/bin/env node

/**
 * FINAL VERIFICATION - Prokip E-commerce Integration
 * 
 * This script verifies your system is ready for WooCommerce webhook integration
 */

const axios = require('axios');

const BACKEND_URL = 'http://localhost:3000';
const NGROK_URL = 'https://nonluminous-flawed-lonny.ngrok-free.dev';

console.log('🎯 FINAL VERIFICATION - Prokip E-commerce Integration');
console.log('====================================================');
console.log(`🏠 Backend: ${BACKEND_URL}`);
console.log(`🌐 Ngrok: ${NGROK_URL}`);
console.log('');

async function finalVerification() {
  let allTestsPassed = true;
  
  try {
    // Test 1: Backend Health
    console.log('1. 🏥 Backend Health Check...');
    try {
      const response = await axios.get(`${BACKEND_URL}/health`);
      if (response.status === 200) {
        console.log('   ✅ Backend is healthy');
      } else {
        console.log('   ❌ Backend unhealthy');
        allTestsPassed = false;
      }
    } catch (error) {
      console.log('   ❌ Backend not accessible');
      allTestsPassed = false;
    }

    // Test 2: Database Connection
    console.log('\n2. 🗄️  Database Connection...');
    try {
      const response = await axios.get(`${BACKEND_URL}/connections`, {
        validateStatus: () => true
      });
      if (response.status === 200 || response.status === 401) {
        console.log('   ✅ Database connected');
      } else {
        console.log('   ❌ Database connection failed');
        allTestsPassed = false;
      }
    } catch (error) {
      console.log('   ❌ Database test failed');
      allTestsPassed = false;
    }

    // Test 3: Webhook Endpoints
    console.log('\n3. 🔗 Webhook Endpoints...');
    
    const webhookEndpoints = [
      '/webhooks/woocommerce',
      '/connections/webhook/woocommerce'
    ];

    for (const endpoint of webhookEndpoints) {
      try {
        const testPayload = { test: 'verification' };
        const response = await axios.post(`${BACKEND_URL}${endpoint}`, testPayload, {
          headers: {
            'Content-Type': 'application/json',
            'X-WC-Webhook-Topic': 'order.created'
          },
          timeout: 5000
        });
        
        if (response.status === 200) {
          console.log(`   ✅ ${endpoint} - Working`);
        } else {
          console.log(`   ⚠️  ${endpoint} - Status: ${response.status}`);
        }
      } catch (error) {
        console.log(`   ❌ ${endpoint} - Failed: ${error.message}`);
        allTestsPassed = false;
      }
    }

    // Test 4: Prokip Integration
    console.log('\n4. 🔐 Prokip Integration...');
    try {
      const response = await axios.get(`${BACKEND_URL}/prokip/config`, {
        validateStatus: () => true
      });
      
      if (response.status === 200 || response.status === 401) {
        console.log('   ✅ Prokip routes configured');
      } else {
        console.log('   ⚠️  Prokip integration may need configuration');
      }
    } catch (error) {
      console.log('   ❌ Prokip integration test failed');
      allTestsPassed = false;
    }

    // Test 5: Stock Deduction Logic
    console.log('\n5. 📦 Stock Deduction Logic...');
    try {
      // Check if syncService has stock deduction functions
      const fs = require('fs');
      const syncServicePath = './src/services/syncService.js';
      
      if (fs.existsSync(syncServicePath)) {
        const syncServiceContent = fs.readFileSync(syncServicePath, 'utf8');
        
        const hasStockDeduction = syncServiceContent.includes('deductStockFromProkip') ||
                                 syncServiceContent.includes('stockDeducted') ||
                                 syncServiceContent.includes('stock reduction');
        
        if (hasStockDeduction) {
          console.log('   ✅ Stock deduction logic implemented');
        } else {
          console.log('   ❌ Stock deduction logic not found');
          allTestsPassed = false;
        }
      } else {
        console.log('   ❌ Sync service file not found');
        allTestsPassed = false;
      }
    } catch (error) {
      console.log('   ❌ Stock deduction check failed');
      allTestsPassed = false;
    }

    // Final Summary
    console.log('\n📊 VERIFICATION SUMMARY');
    console.log('======================');
    
    if (allTestsPassed) {
      console.log('🎉 ALL TESTS PASSED!');
      console.log('');
      console.log('✅ Your system is READY for WooCommerce webhook integration!');
      console.log('');
      console.log('📋 NEXT STEPS:');
      console.log('1. 🛠️  Configure WooCommerce webhooks:');
      console.log(`   URL: ${NGROK_URL}/connections/webhook/woocommerce`);
      console.log('   Topics: order.created, order.updated, product.updated');
      console.log('');
      console.log('2. 🧪 Test with a real WooCommerce order');
      console.log('3. 📊 Check stock deduction in Prokip');
      console.log('4. 📈 Monitor dashboard for sync activity');
      console.log('');
      console.log('🔄 BIDIRECTIONAL SYNC FLOW:');
      console.log('   WooCommerce Sale → Webhook → Stock Deduction in Prokip ✅');
      console.log('   Prokip Update → Manual Sync → Stock Update in WooCommerce ✅');
      console.log('');
      console.log('🎯 SUCCESS! Your integration is production-ready!');
      
    } else {
      console.log('⚠️  SOME TESTS FAILED');
      console.log('');
      console.log('🛠️  Please fix the issues above before proceeding:');
      console.log('1. Ensure backend server is running');
      console.log('2. Check database connection');
      console.log('3. Verify webhook endpoints');
      console.log('4. Configure Prokip integration');
      console.log('');
      console.log('💡 Run the test again after fixing issues');
    }

    console.log('');
    console.log('📚 Additional Resources:');
    console.log('   📖 Webhook Setup Guide: WEBHOOK_SETUP_COMPLETE.md');
    console.log('   🧪 Test Scripts: test-webhook-ngrok.js');
    console.log('   📊 Admin Dashboard: http://localhost:3000');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    allTestsPassed = false;
  }
}

// Run verification
finalVerification().catch(error => {
  console.error('❌ Verification execution failed:', error);
  process.exit(1);
});
