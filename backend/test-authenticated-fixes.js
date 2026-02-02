const axios = require('axios');

/**
 * Test the inventory sync fixes using proper Prokip authentication
 */

async function getProkipToken() {
  try {
    console.log('🔐 Getting Prokip authentication token...');
    
    // Try to get existing Prokip config from database
    const prisma = require('./src/lib/prisma');
    
    const prokipConfig = await prisma.prokipConfig.findFirst({ 
      where: { userId: 50 } // Default user ID
    });
    
    if (!prokipConfig || !prokipConfig.token) {
      throw new Error('No Prokip configuration found. Please configure Prokip first.');
    }
    
    console.log('✅ Found Prokip token for user:', prokipConfig.userId);
    return prokipConfig.token;
    
  } catch (error) {
    console.error('❌ Failed to get Prokip token:', error.message);
    return null;
  }
}

async function testInventorySyncWithAuth() {
  try {
    console.log('🧪 Testing inventory sync with authentication...');
    
    const token = await getProkipToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    // Test the inventory sync endpoint with proper authentication
    const response = await axios.post('http://localhost:3000/sync/inventory', {
      connectionId: 10 // Using the connection ID from your logs
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Inventory sync response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Inventory sync test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testProductPushWithAuth() {
  try {
    console.log('🧪 Testing product push with authentication...');
    
    const token = await getProkipToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    // Test the product push endpoint with proper authentication
    const response = await axios.post('http://localhost:3000/sync/products', {
      connectionId: 10 // Using the connection ID from your logs
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Product push response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Product push test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testPullSalesWithAuth() {
  try {
    console.log('🧪 Testing pull sales with authentication...');
    
    const token = await getProkipToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    // Test the pull sales endpoint with proper authentication
    const response = await axios.post('http://localhost:3000/sync/pull-sales', {
      connectionId: 10 // Using the connection ID from your logs
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Pull sales response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Pull sales test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function checkServerHealth() {
  try {
    console.log('🏥 Checking server health...');
    const response = await axios.get('http://localhost:3000/health');
    console.log('✅ Server health:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Server health check failed:', error.message);
    return false;
  }
}

async function runAuthenticatedTests() {
  console.log('🚀 Starting authenticated integration tests...\n');
  
  // First check if server is running
  const serverHealthy = await checkServerHealth();
  if (!serverHealthy) {
    console.log('❌ Server is not running. Please start the server first.');
    return;
  }
  
  const results = {
    inventorySync: false,
    productPush: false,
    pullSales: false
  };
  
  try {
    results.inventorySync = await testInventorySyncWithAuth();
  } catch (error) {
    console.error('Inventory sync test failed:', error.message);
  }
  
  try {
    results.productPush = await testProductPushWithAuth();
  } catch (error) {
    console.error('Product push test failed:', error.message);
  }
  
  try {
    results.pullSales = await testPullSalesWithAuth();
  } catch (error) {
    console.error('Pull sales test failed:', error.message);
  }
  
  console.log('\n📊 Test Results:');
  console.log('Inventory Sync:', results.inventorySync ? '✅ PASS' : '❌ FAIL');
  console.log('Product Push:', results.productPush ? '✅ PASS' : '❌ FAIL');
  console.log('Pull Sales:', results.pullSales ? '✅ PASS' : '❌ FAIL');
  
  const allPassed = Object.values(results).every(result => result);
  console.log('\n' + (allPassed ? '🎉 All tests passed!' : '⚠️ Some tests failed'));
  
  if (allPassed) {
    console.log('\n✅ Your inventory sync and product push issues have been fixed!');
    console.log('💡 You can now:');
    console.log('   - Sync inventory from Prokip to WooCommerce (including zero stock items)');
    console.log('   - Push new products from Prokip to WooCommerce');
    console.log('   - Pull sales/orders from WooCommerce to Prokip');
  }
}

// Run the tests
runAuthenticatedTests().catch(console.error);
