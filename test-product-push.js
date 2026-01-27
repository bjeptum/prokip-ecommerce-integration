const axios = require('axios');

async function testProductPush() {
  try {
    console.log('Testing product push to WooCommerce...');
    
    // First, let's check what connections exist
    const connectionsResponse = await axios.get('http://localhost:3000/connections', {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });
    
    console.log('Available connections:', connectionsResponse.data);
    
    // Test the product push endpoint
    const pushResponse = await axios.post('http://localhost:3000/setup/products', {
      method: 'push',
      connectionId: 1
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }
    });
    
    console.log('Product push response:', pushResponse.data);
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

testProductPush();
