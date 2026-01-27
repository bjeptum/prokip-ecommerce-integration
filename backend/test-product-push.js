const axios = require('axios');

async function testProductPush() {
  try {
    console.log('Testing product push to WooCommerce...');
    
    // First, let's check what connections exist
    try {
      const connectionsResponse = await axios.get('http://localhost:3000/connections', {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      console.log('Available connections:', connectionsResponse.data);
    } catch (connError) {
      console.log('Connections endpoint not available, trying direct test...');
    }
    
    // Test the product push endpoint directly
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
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testProductPush();
