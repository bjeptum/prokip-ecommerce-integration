const axios = require('axios');

/**
 * Test script to verify inventory sync and product push fixes
 */

async function testInventorySync() {
  try {
    console.log('🧪 Testing inventory sync endpoint...');
    
    // Test the inventory sync endpoint
    const response = await axios.post('http://localhost:3000/sync/inventory', {
      connectionId: 10 // Using the connection ID from your logs
    }, {
      headers: {
        'Authorization': 'Bearer your-token-here',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Inventory sync response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Inventory sync test failed:', error.response?.data || error.message);
    return false;
  }
}

async function testProductPush() {
  try {
    console.log('🧪 Testing product push endpoint...');
    
    // Test the product push endpoint
    const response = await axios.post('http://localhost:3000/sync/products', {
      connectionId: 10 // Using the connection ID from your logs
    }, {
      headers: {
        'Authorization': 'Bearer your-token-here',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Product push response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Product push test failed:', error.response?.data || error.message);
    return false;
  }
}

async function testPullSales() {
  try {
    console.log('🧪 Testing pull sales endpoint...');
    
    // Test the pull sales endpoint
    const response = await axios.post('http://localhost:3000/sync/pull-sales', {
      connectionId: 10 // Using the connection ID from your logs
    }, {
      headers: {
        'Authorization': 'Bearer your-token-here',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Pull sales response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Pull sales test failed:', error.response?.data || error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting integration tests...\n');
  
  const results = {
    inventorySync: await testInventorySync(),
    productPush: await testProductPush(),
    pullSales: await testPullSales()
  };
  
  console.log('\n📊 Test Results:');
  console.log('Inventory Sync:', results.inventorySync ? '✅ PASS' : '❌ FAIL');
  console.log('Product Push:', results.productPush ? '✅ PASS' : '❌ FAIL');
  console.log('Pull Sales:', results.pullSales ? '✅ PASS' : '❌ FAIL');
  
  const allPassed = Object.values(results).every(result => result);
  console.log('\n' + (allPassed ? '🎉 All tests passed!' : '⚠️ Some tests failed'));
}

// Run the tests
runTests().catch(console.error);
