require('dotenv').config();

const axios = require('axios');

// Test configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_USER_ID = process.env.TEST_USER_ID || 'test-user-123';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log('\n' + '='.repeat(60), 'cyan');
  log(`🧪 ${title}`, 'cyan');
  log('='.repeat(60), 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️ ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️ ${message}`, 'blue');
}

// Test data
const testUser = {
  userId: TEST_USER_ID,
  email: process.env.PROKIP_USERNAME || 'test@example.com',
  password: process.env.PROKIP_PASSWORD || 'test-password',
  connectionName: 'Test Connection'
};

const testWooOrder = {
  id: Date.now(),
  number: `TEST-${Date.now()}`,
  total: '299.99',
  status: 'processing',
  billing: {
    first_name: 'Test',
    last_name: 'Customer',
    email: 'test@example.com',
    phone: '+1234567890',
    address_1: '123 Test Street',
    city: 'Test City',
    state: 'Test State',
    postcode: '12345',
    country: 'US'
  },
  shipping: {
    first_name: 'Test',
    last_name: 'Customer',
    address_1: '123 Test Street',
    city: 'Test City',
    state: 'Test State',
    postcode: '12345',
    country: 'US'
  },
  line_items: [
    {
      id: 1,
      product_id: 123,
      variation_id: 456,
      sku: 'TEST-SKU-001',
      name: 'Test Product',
      quantity: 2,
      price: '149.99',
      total: '299.99'
    }
  ]
};

const testStockItems = [
  { sku: 'TEST-SKU-001', quantity: 2 },
  { sku: 'TEST-SKU-002', quantity: 1 }
];

// API helper functions
async function apiCall(endpoint, method = 'GET', data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };

  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500
    };
  }
}

// Test functions
async function testEnvironmentSetup() {
  logSection('Environment Setup Check');

  const requiredEnvVars = [
    'DATABASE_URL',
    'PROKIP_BASE_URL',
    'ENCRYPTION_SECRET'
  ];

  let allSet = true;
  
  requiredEnvVars.forEach(varName => {
    if (process.env[varName]) {
      logSuccess(`${varName}: ✓ Set`);
    } else {
      logError(`${varName}: ✗ Missing`);
      allSet = false;
    }
  });

  if (process.env.PROKIP_USERNAME && process.env.PROKIP_PASSWORD) {
    logSuccess('Prokip credentials: ✓ Set');
  } else {
    logWarning('Prokip credentials: ⚠️ Using test credentials');
  }

  logInfo(`API Base URL: ${API_BASE_URL}`);
  logInfo(`Test User ID: ${TEST_USER_ID}`);

  return allSet;
}

async function testUserConnection() {
  logSection('User Connection Test');

  try {
    // Test connection status
    logInfo('Checking connection status...');
    const statusResult = await apiCall(`/api/prokip/auth/status/${TEST_USER_ID}`);
    
    if (statusResult.success) {
      const { connected, needsReauth } = statusResult.data;
      
      if (connected) {
        logSuccess('User has active connection');
        if (needsReauth) {
          logWarning('Connection needs re-authentication');
        }
        return true;
      } else {
        logInfo('No active connection found, attempting to connect...');
      }
    }

    // Test user authentication
    logInfo('Attempting user authentication...');
    const authResult = await apiCall('/api/prokip/auth/connect', 'POST', testUser);
    
    if (authResult.success) {
      logSuccess('User authentication successful');
      logInfo(`Connection ID: ${authResult.data.data.connectionId}`);
      return true;
    } else {
      logError(`Authentication failed: ${authResult.error?.message || authResult.error}`);
      return false;
    }

  } catch (error) {
    logError(`Connection test failed: ${error.message}`);
    return false;
  }
}

async function testStockCheck() {
  logSection('Stock Availability Check');

  try {
    logInfo('Checking stock availability...');
    const stockResult = await apiCall(`/api/prokip/test-stock/${TEST_USER_ID}`, 'POST', {
      items: testStockItems
    });

    if (stockResult.success) {
      logSuccess('Stock check completed');
      const { allAvailable, stockChecks } = stockResult.data.data;
      
      logInfo(`All items available: ${allAvailable ? '✓' : '✗'}`);
      
      stockChecks.forEach(item => {
        const status = item.available ? '✓' : '✗';
        logInfo(`  ${item.sku}: ${status} (Requested: ${item.requestedQuantity}, Available: ${item.currentStock || 'Unknown'})`);
      });
      
      return true;
    } else {
      logError(`Stock check failed: ${stockResult.error?.message || stockResult.error}`);
      return false;
    }

  } catch (error) {
    logError(`Stock check error: ${error.message}`);
    return false;
  }
}

async function testOrderProcessing() {
  logSection('Order Processing Test');

  try {
    logInfo('Processing test WooCommerce order...');
    const orderResult = await apiCall(`/api/prokip/test-order/${TEST_USER_ID}`, 'POST', {
      useSample: true
    });

    if (orderResult.success) {
      logSuccess('Order processed successfully');
      const { transactionId, prokipTransactionId, receiptNumber } = orderResult.data.data;
      
      logInfo(`Transaction ID: ${transactionId}`);
      logInfo(`Prokip Transaction ID: ${prokipTransactionId || 'Pending'}`);
      logInfo(`Receipt Number: ${receiptNumber || 'Pending'}`);
      
      return { success: true, transactionId };
    } else {
      logError(`Order processing failed: ${orderResult.error?.message || orderResult.error}`);
      return { success: false, error: orderResult.error };
    }

  } catch (error) {
    logError(`Order processing error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testWebhookEndpoint() {
  logSection('Webhook Endpoint Test');

  try {
    logInfo('Testing webhook endpoint...');
    const webhookResult = await apiCall(`/webhooks/woocommerce/test/${TEST_USER_ID}`, 'POST');

    if (webhookResult.success) {
      logSuccess('Webhook test successful');
      const { transactionId } = webhookResult.data.data;
      logInfo(`Webhook Transaction ID: ${transactionId}`);
      return true;
    } else {
      logError(`Webhook test failed: ${webhookResult.error?.message || webhookResult.error}`);
      return false;
    }

  } catch (error) {
    logError(`Webhook test error: ${error.message}`);
    return false;
  }
}

async function testTransactionHistory() {
  logSection('Transaction History Test');

  try {
    logInfo('Retrieving transaction history...');
    const historyResult = await apiCall(`/api/prokip/transactions/${TEST_USER_ID}`);

    if (historyResult.success) {
      logSuccess('Transaction history retrieved');
      const { transactions, pagination } = historyResult.data.data;
      
      logInfo(`Total transactions: ${pagination.total}`);
      logInfo(`Page: ${pagination.page} of ${pagination.pages}`);
      
      transactions.forEach((tx, index) => {
        logInfo(`  ${index + 1}. Order ${tx.wooOrderNumber} - ${tx.status} (${tx.createdAt})`);
      });
      
      return true;
    } else {
      logError(`Transaction history failed: ${historyResult.error?.message || historyResult.error}`);
      return false;
    }

  } catch (error) {
    logError(`Transaction history error: ${error.message}`);
    return false;
  }
}

async function testUserSettings() {
  logSection('User Settings Test');

  try {
    logInfo('Getting user settings...');
    const getSettingsResult = await apiCall(`/api/prokip/settings/${TEST_USER_ID}`);

    if (getSettingsResult.success) {
      logSuccess('Settings retrieved');
      const settings = getSettingsResult.data.data;
      logInfo(`Auto-sync enabled: ${settings.autoSyncEnabled}`);
      logInfo(`Stock check enabled: ${settings.stockCheckEnabled}`);
      logInfo(`Max retries: ${settings.maxRetries}`);
    }

    logInfo('Updating user settings...');
    const updateSettingsResult = await apiCall(`/api/prokip/settings/${TEST_USER_ID}`, 'PUT', {
      autoSyncEnabled: true,
      stockCheckEnabled: true,
      maxRetries: 5,
      lowStockThreshold: 10
    });

    if (updateSettingsResult.success) {
      logSuccess('Settings updated successfully');
      return true;
    } else {
      logError(`Settings update failed: ${updateSettingsResult.error?.message || updateSettingsResult.error}`);
      return false;
    }

  } catch (error) {
    logError(`Settings test error: ${error.message}`);
    return false;
  }
}

async function testUserStats() {
  logSection('User Statistics Test');

  try {
    logInfo('Getting user statistics...');
    const statsResult = await apiCall(`/api/prokip/stats/${TEST_USER_ID}`);

    if (statsResult.success) {
      logSuccess('Statistics retrieved');
      const { connection, transactions } = statsResult.data.data;
      
      logInfo(`Connection status: ${connection.connected ? 'Connected' : 'Not connected'}`);
      logInfo(`Connection name: ${connection.connectionName || 'N/A'}`);
      logInfo(`Last sync: ${connection.lastSyncAt || 'Never'}`);
      logInfo(`Total transactions: ${transactions.total}`);
      logInfo(`Completed: ${transactions.completed}`);
      logInfo(`Failed: ${transactions.failed}`);
      logInfo(`Success rate: ${transactions.successRate}%`);
      
      return true;
    } else {
      logError(`Statistics test failed: ${statsResult.error?.message || statsResult.error}`);
      return false;
    }

  } catch (error) {
    logError(`Statistics test error: ${error.message}`);
    return false;
  }
}

async function testDisconnection() {
  logSection('User Disconnection Test');

  try {
    logInfo('Disconnecting user...');
    const disconnectResult = await apiCall(`/api/prokip/auth/disconnect/${TEST_USER_ID}`, 'POST');

    if (disconnectResult.success) {
      logSuccess('User disconnected successfully');
      return true;
    } else {
      logError(`Disconnection failed: ${disconnectResult.error?.message || disconnectResult.error}`);
      return false;
    }

  } catch (error) {
    logError(`Disconnection test error: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  logSection('🚀 Per-User WooCommerce → Prokip Integration Test Suite');
  logInfo(`Started at: ${new Date().toISOString()}`);

  const testResults = {
    environment: await testEnvironmentSetup(),
    connection: await testUserConnection(),
    stockCheck: await testStockCheck(),
    orderProcessing: await testOrderProcessing(),
    webhook: await testWebhookEndpoint(),
    transactionHistory: await testTransactionHistory(),
    settings: await testUserSettings(),
    stats: await testUserStats(),
    disconnection: await testDisconnection()
  };

  // Summary
  logSection('📊 Test Results Summary');
  
  const passed = Object.values(testResults).filter(result => result === true).length;
  const total = Object.keys(testResults).length;
  
  Object.entries(testResults).forEach(([testName, result]) => {
    const status = result === true ? '✅ PASS' : result === false ? '❌ FAIL' : '⚠️ PARTIAL';
    const color = result === true ? 'green' : result === false ? 'red' : 'yellow';
    log(`${testName.padEnd(20)}: ${status}`, color);
  });

  log(`\nOverall: ${passed}/${total} tests passed`, passed === total ? 'green' : 'red');

  if (passed === total) {
    logSuccess('🎉 All tests passed! The per-user integration is working correctly.');
  } else {
    logWarning('⚠️ Some tests failed. Please check the errors above and fix them.');
  }

  logInfo(`Test completed at: ${new Date().toISOString()}`);
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    logError(`Test suite failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  testEnvironmentSetup,
  testUserConnection,
  testStockCheck,
  testOrderProcessing,
  testWebhookEndpoint,
  testTransactionHistory,
  testUserSettings,
  testUserStats,
  testDisconnection
};
