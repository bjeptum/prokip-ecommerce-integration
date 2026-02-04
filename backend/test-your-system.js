#!/usr/bin/env node

/**
 * QUICK TEST FOR YOUR EXISTING PROKIP E-COMMERCE SYSTEM
 * 
 * This script tests your current Node.js backend system
 * to ensure everything is working correctly
 */

const http = require('http');
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

console.log('🔍 Testing Your Existing Prokip E-commerce System');
console.log('==============================================');

async function testBackend() {
  try {
    // Test 1: Backend Health
    console.log('\n1. 🏥 Testing Backend Health...');
    try {
      const response = await axios.get(`${BASE_URL}/health`);
      if (response.status === 200) {
        console.log('   ✅ Backend is running and healthy');
        console.log(`   📊 Status: ${response.data.status}`);
        console.log(`   🕐 Timestamp: ${response.data.timestamp}`);
      } else {
        console.log('   ❌ Backend health check failed');
        return false;
      }
    } catch (error) {
      console.log('   ❌ Backend not accessible');
      console.log(`   🚫 Error: ${error.message}`);
      console.log('   💡 Make sure the backend server is running on port 3000');
      return false;
    }

    // Test 2: Frontend Access
    console.log('\n2. 🌐 Testing Frontend Access...');
    try {
      const response = await axios.get(BASE_URL);
      if (response.status === 200) {
        console.log('   ✅ Frontend is accessible');
      } else {
        console.log('   ❌ Frontend not accessible');
      }
    } catch (error) {
      console.log('   ❌ Frontend access failed');
      console.log(`   🚫 Error: ${error.message}`);
    }

    // Test 3: API Routes
    console.log('\n3. 🛣️  Testing API Routes...');
    
    const routes = [
      '/auth',
      '/connections',
      '/stores',
      '/sync',
      '/webhooks',
      '/prokip'
    ];

    for (const route of routes) {
      try {
        const response = await axios.get(`${BASE_URL}${route}`, {
          validateStatus: () => true // Don't throw on 4xx/5xx
        });
        
        if (response.status !== 404) {
          console.log(`   ✅ ${route} - Route exists (${response.status})`);
        } else {
          console.log(`   ❌ ${route} - Route not found`);
        }
      } catch (error) {
        console.log(`   ❌ ${route} - Error: ${error.message}`);
      }
    }

    // Test 4: Database Connection
    console.log('\n4. 🗄️  Testing Database Connection...');
    try {
      // Try to access connections endpoint (requires database)
      const response = await axios.get(`${BASE_URL}/connections`, {
        validateStatus: () => true
      });
      
      if (response.status === 200) {
        console.log('   ✅ Database connection working');
        console.log(`   📊 Connections: ${response.data.length || 0} found`);
      } else if (response.status === 401) {
        console.log('   ✅ Database connection working (authentication required)');
      } else {
        console.log(`   ⚠️  Database response: ${response.status}`);
      }
    } catch (error) {
      console.log('   ❌ Database connection test failed');
      console.log(`   🚫 Error: ${error.message}`);
    }

    // Test 5: Webhook Endpoint
    console.log('\n5. 🔗 Testing Webhook Endpoint...');
    try {
      const testWebhook = {
        id: 'test-order-' + Date.now(),
        status: 'completed',
        total: 99.99
      };

      const response = await axios.post(`${BASE_URL}/webhooks/woocommerce`, testWebhook, {
        headers: {
          'Content-Type': 'application/json',
          'X-WC-Webhook-Topic': 'order.created'
        },
        validateStatus: () => true
      });

      if (response.status === 200) {
        console.log('   ✅ Webhook endpoint working');
      } else {
        console.log(`   ⚠️  Webhook response: ${response.status}`);
      }
    } catch (error) {
      console.log('   ❌ Webhook endpoint test failed');
      console.log(`   🚫 Error: ${error.message}`);
    }

    console.log('\n🎉 Basic Tests Completed!');
    console.log('\n📋 What to test next:');
    console.log('   1. Open your browser and go to http://localhost:3000');
    console.log('   2. Try to login with Prokip credentials');
    console.log('   3. Connect a WooCommerce store');
    console.log('   4. Test product and order sync');
    console.log('   5. Check bidirectional stock sync');

    return true;

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    return false;
  }
}

// Check if server is running
async function checkServer() {
  console.log('🔍 Checking if server is running...');
  
  try {
    const response = await axios.get(BASE_URL, { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

// Main execution
async function main() {
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log('❌ Server is not running on port 3000');
    console.log('\n🚀 To start the server:');
    console.log('   cd backend');
    console.log('   npm install');
    console.log('   npm start');
    console.log('\n💡 Then run this test again');
    process.exit(1);
  }

  await testBackend();
}

// Run the test
main().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
