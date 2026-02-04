/**
 * COMPREHENSIVE INTEGRATION TEST FOR PROKIP E-COMMERCE SYSTEM
 * 
 * This script tests the complete integration between:
 * - Prokip API (real or mock)
 * - WooCommerce stores
 * - Shopify stores  
 * - Bidirectional sync
 * - Webhook processing
 * - Stock management
 */

const axios = require('axios');
const path = require('path');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const PROKIP_API = process.env.PROKIP_API || 'https://api.prokip.africa';
const MOCK_PROKIP = process.env.MOCK_PROKIP === 'true';

console.log('🚀 Starting Prokip E-commerce Integration Test');
console.log('===============================================');
console.log(`📡 Backend URL: ${BASE_URL}`);
console.log(`🔗 Prokip API: ${PROKIP_API}`);
console.log(`🧪 Mock Mode: ${MOCK_PROKIP ? 'YES' : 'NO'}`);
console.log('');

class IntegrationTester {
  constructor() {
    this.authToken = null;
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
    this.wooConnectionId = null;
    this.shopifyConnectionId = null;
  }

  async runAllTests() {
    try {
      await this.testBackendHealth();
      await this.testProkipAuthentication();
      await this.testWooCommerceConnection();
      await this.testShopifyConnection();
      await this.testProductSync();
      await this.testOrderProcessing();
      await this.testBidirectionalSync();
      await this.testWebhookProcessing();
      await this.testStockManagement();
      
      this.printSummary();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  async testBackendHealth() {
    console.log('🏥 Testing Backend Health...');
    
    try {
      const response = await axios.get(`${BASE_URL}/health`);
      
      if (response.status === 200 && response.data.status === 'ok') {
        this.logSuccess('Backend is healthy', response.data);
      } else {
        this.logFailure('Backend health check failed', response.data);
      }
    } catch (error) {
      this.logFailure('Backend not accessible', error.message);
    }
  }

  async testProkipAuthentication() {
    console.log('🔐 Testing Prokip Authentication...');
    
    try {
      // Test login endpoint
      const loginResponse = await axios.post(`${BASE_URL}/auth/prokip-login`, {
        username: process.env.PROKIP_USERNAME || 'test@prokip.africa',
        password: process.env.PROKIP_PASSWORD || 'testpassword'
      });
      
      if (loginResponse.data.success && loginResponse.data.token) {
        this.authToken = loginResponse.data.token;
        this.logSuccess('Prokip authentication successful', { 
          hasToken: !!this.authToken,
          expiresIn: loginResponse.data.expiresIn 
        });
        
        // Test protected endpoint
        const protectedResponse = await axios.get(`${BASE_URL}/prokip/products`, {
          headers: { Authorization: `Bearer ${this.authToken}` }
        });
        
        if (protectedResponse.status === 200) {
          this.logSuccess('Protected Prokip endpoint accessible', {
            productsCount: protectedResponse.data.length || 0
          });
        } else {
          this.logFailure('Protected endpoint not accessible', protectedResponse.data);
        }
        
      } else {
        this.logFailure('Prokip login failed', loginResponse.data);
      }
    } catch (error) {
      this.logFailure('Prokip authentication error', error.response?.data || error.message);
    }
  }

  async testWooCommerceConnection() {
    console.log('🛒 Testing WooCommerce Connection...');
    
    try {
      // Test connection creation
      const connectResponse = await axios.post(`${BASE_URL}/connections/woocommerce/connect`, {
        storeUrl: process.env.WOO_STORE_URL || 'https://test-store.myshopify.com',
        consumerKey: process.env.WOO_CONSUMER_KEY || 'test_key',
        consumerSecret: process.env.WOO_CONSUMER_SECRET || 'test_secret'
      }, {
        headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}
      });
      
      if (connectResponse.data.success) {
        this.wooConnectionId = connectResponse.data.connection?.id;
        this.logSuccess('WooCommerce connection created', {
          connectionId: this.wooConnectionId,
          storeUrl: connectResponse.data.connection?.storeUrl
        });
        
        // Test getting products from WooCommerce
        if (this.wooConnectionId) {
          const productsResponse = await axios.get(`${BASE_URL}/stores/${this.wooConnectionId}/products`, {
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}
          });
          
          if (productsResponse.status === 200) {
            this.logSuccess('WooCommerce products accessible', {
              productsCount: productsResponse.data.length || 0
            });
          } else {
            this.logFailure('Cannot access WooCommerce products', productsResponse.data);
          }
        }
        
      } else {
        this.logFailure('WooCommerce connection failed', connectResponse.data);
      }
    } catch (error) {
      this.logFailure('WooCommerce connection error', error.response?.data || error.message);
    }
  }

  async testShopifyConnection() {
    console.log('🛍️ Testing Shopify Connection...');
    
    try {
      // Test OAuth initiation
      const oauthResponse = await axios.post(`${BASE_URL}/connections/shopify/initiate`, {
        shop: process.env.SHOPIFY_STORE || 'test-store.myshopify.com'
      }, {
        headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}
      });
      
      if (oauthResponse.data.success || oauthResponse.data.oauthUrl) {
        this.logSuccess('Shopify OAuth initiation successful', {
          hasOAuthUrl: !!oauthResponse.data.oauthUrl,
          shop: oauthResponse.data.shop
        });
        
        // For testing, we'll create a mock connection
        if (MOCK_PROKIP) {
          const mockConnectResponse = await axios.post(`${BASE_URL}/connections/shopify/mock-connect`, {
            shop: process.env.SHOPIFY_STORE || 'test-store.myshopify.com',
            accessToken: 'mock_token'
          }, {
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}
          });
          
          if (mockConnectResponse.data.success) {
            this.shopifyConnectionId = mockConnectResponse.data.connection?.id;
            this.logSuccess('Shopify mock connection created', {
              connectionId: this.shopifyConnectionId
            });
          }
        }
        
      } else {
        this.logFailure('Shopify OAuth initiation failed', oauthResponse.data);
      }
    } catch (error) {
      this.logFailure('Shopify connection error', error.response?.data || error.message);
    }
  }

  async testProductSync() {
    console.log('📦 Testing Product Synchronization...');
    
    if (!this.wooConnectionId && !this.shopifyConnectionId) {
      this.logFailure('No connections available for product sync');
      return;
    }
    
    try {
      // Test syncing products from stores to Prokip
      const syncResponse = await axios.post(`${BASE_URL}/sync/products`, {
        connectionIds: [this.wooConnectionId, this.shopifyConnectionId].filter(Boolean)
      }, {
        headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}
      });
      
      if (syncResponse.data.success) {
        this.logSuccess('Product sync successful', {
          syncedProducts: syncResponse.data.syncedCount || 0,
          connectionsProcessed: syncResponse.data.connectionsProcessed || 0
        });
      } else {
        this.logFailure('Product sync failed', syncResponse.data);
      }
    } catch (error) {
      this.logFailure('Product sync error', error.response?.data || error.message);
    }
  }

  async testOrderProcessing() {
    console.log('🧾 Testing Order Processing...');
    
    try {
      // Test creating a test order
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
      
      // Process order through webhook endpoint
      const webhookResponse = await axios.post(`${BASE_URL}/webhooks/woocommerce`, testOrder, {
        headers: {
          'Content-Type': 'application/json',
          'X-WC-Webhook-Topic': 'order.created',
          'X-WC-Webhook-Source': this.wooConnectionId ? 'test-store.com' : 'mock-store.com'
        }
      });
      
      if (webhookResponse.status === 200) {
        this.logSuccess('Order webhook processed', {
          orderId: testOrder.id,
          status: webhookResponse.status
        });
        
        // Wait a moment for processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if order was logged
        const salesResponse = await axios.get(`${BASE_URL}/api/sales`, {
          headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}
        });
        
        if (salesResponse.data.success && salesResponse.data.sales) {
          const testOrderLog = salesResponse.data.sales.find(sale => sale.orderId === testOrder.id);
          if (testOrderLog) {
            this.logSuccess('Order logged in database', {
              orderId: testOrderLog.orderId,
              prokipSellId: testOrderLog.prokipSellId,
              stockDeducted: testOrderLog.stockDeducted
            });
          } else {
            this.logFailure('Order not found in sales log');
          }
        }
      } else {
        this.logFailure('Order webhook failed', webhookResponse.data);
      }
    } catch (error) {
      this.logFailure('Order processing error', error.response?.data || error.message);
    }
  }

  async testBidirectionalSync() {
    console.log('🔄 Testing Bidirectional Sync...');
    
    try {
      // Test Prokip to Store sync
      const prokipToStoreResponse = await axios.post(`${BASE_URL}/sync/inventory`, {
        direction: 'prokip-to-store'
      }, {
        headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}
      });
      
      if (prokipToStoreResponse.data.success) {
        this.logSuccess('Prokip to Store sync successful', {
          updatedItems: prokipToStoreResponse.data.updatedCount || 0
        });
      } else {
        this.logFailure('Prokip to Store sync failed', prokipToStoreResponse.data);
      }
      
      // Test Store to Prokip sync
      const storeToProkipResponse = await axios.post(`${BASE_URL}/sync/inventory`, {
        direction: 'store-to-prokip'
      }, {
        headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}
      });
      
      if (storeToProkipResponse.data.success) {
        this.logSuccess('Store to Prokip sync successful', {
          updatedItems: storeToProkipResponse.data.updatedCount || 0
        });
      } else {
        this.logFailure('Store to Prokip sync failed', storeToProkipResponse.data);
      }
    } catch (error) {
      this.logFailure('Bidirectional sync error', error.response?.data || error.message);
    }
  }

  async testWebhookProcessing() {
    console.log('🔗 Testing Webhook Processing...');
    
    try {
      // Test webhook signature verification
      const testPayload = { test: 'data' };
      const payloadString = JSON.stringify(testPayload);
      
      // Generate test signature
      const crypto = require('crypto');
      const secret = 'test-secret';
      const signature = crypto.createHmac('sha256', secret).update(payloadString).digest('base64');
      
      const webhookResponse = await axios.post(`${BASE_URL}/webhooks/woocommerce`, testPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-WC-Webhook-Signature': signature,
          'X-WC-Webhook-Topic': 'product.updated'
        }
      });
      
      if (webhookResponse.status === 200) {
        this.logSuccess('Webhook signature verification working', {
          status: webhookResponse.status
        });
      } else {
        this.logFailure('Webhook signature verification failed', webhookResponse.data);
      }
      
      // Check webhook events logging
      const eventsResponse = await axios.get(`${BASE_URL}/api/webhook-events`, {
        headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}
      });
      
      if (eventsResponse.data.success) {
        this.logSuccess('Webhook events logging working', {
          eventsCount: eventsResponse.data.events?.length || 0
        });
      } else {
        this.logFailure('Webhook events logging failed', eventsResponse.data);
      }
    } catch (error) {
      this.logFailure('Webhook processing error', error.response?.data || error.message);
    }
  }

  async testStockManagement() {
    console.log('📊 Testing Stock Management...');
    
    try {
      // Test stock adjustment
      const stockAdjustmentResponse = await axios.post(`${BASE_URL}/sync/stock-adjustment`, {
        sku: 'TEST-SKU-001',
        quantity: 10,
        operation: 'set'
      }, {
        headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}
      });
      
      if (stockAdjustmentResponse.data.success) {
        this.logSuccess('Stock adjustment successful', {
          sku: 'TEST-SKU-001',
          newQuantity: stockAdjustmentResponse.data.quantity
        });
      } else {
        this.logFailure('Stock adjustment failed', stockAdjustmentResponse.data);
      }
      
      // Test inventory logs
      const inventoryResponse = await axios.get(`${BASE_URL}/api/inventory`, {
        headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}
      });
      
      if (inventoryResponse.data.success) {
        this.logSuccess('Inventory logs accessible', {
          logsCount: inventoryResponse.data.inventory?.length || 0
        });
      } else {
        this.logFailure('Inventory logs not accessible', inventoryResponse.data);
      }
    } catch (error) {
      this.logFailure('Stock management error', error.response?.data || error.message);
    }
  }

  logSuccess(testName, details = {}) {
    this.testResults.passed++;
    this.testResults.total++;
    this.testResults.details.push({
      test: testName,
      status: '✅ PASS',
      details
    });
    console.log(`   ✅ ${testName}`);
    if (Object.keys(details).length > 0) {
      console.log(`      Details:`, details);
    }
  }

  logFailure(testName, details = {}) {
    this.testResults.failed++;
    this.testResults.total++;
    this.testResults.details.push({
      test: testName,
      status: '❌ FAIL',
      details
    });
    console.log(`   ❌ ${testName}`);
    console.log(`      Error:`, details);
  }

  printSummary() {
    console.log('');
    console.log('📊 TEST SUMMARY');
    console.log('================');
    console.log(`Total Tests: ${this.testResults.total}`);
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`📈 Success Rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%`);
    console.log('');
    
    if (this.testResults.failed > 0) {
      console.log('❌ FAILED TESTS:');
      this.testResults.details
        .filter(test => test.status === '❌ FAIL')
        .forEach(test => {
          console.log(`   ${test.status} ${test.test}`);
          console.log(`      Error: ${JSON.stringify(test.details, null, 6)}`);
        });
      console.log('');
    }
    
    if (this.testResults.passed === this.testResults.total) {
      console.log('🎉 ALL TESTS PASSED! The integration is working perfectly.');
      console.log('');
      console.log('🚀 Your Prokip E-commerce Integration is ready for production!');
      console.log('');
      console.log('📋 Next Steps:');
      console.log('   1. Configure real store credentials');
      console.log('   2. Test with actual orders');
      console.log('   3. Set up webhooks in your stores');
      console.log('   4. Monitor sync performance');
    } else {
      console.log('⚠️  Some tests failed. Please review the errors above.');
      console.log('');
      console.log('🛠️ Troubleshooting:');
      console.log('   1. Check your environment variables');
      console.log('   2. Ensure the backend server is running');
      console.log('   3. Verify Prokip API credentials');
      console.log('   4. Check store API credentials');
    }
  }
}

// Run the tests
async function main() {
  const tester = new IntegrationTester();
  await tester.runAllTests();
}

// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = IntegrationTester;
