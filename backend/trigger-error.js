const axios = require('axios');

async function triggerInventorySync() {
  try {
    console.log('🔄 Triggering inventory sync to see error...');
    
    const response = await axios.post('http://localhost:3000/sync/inventory', 
      { connectionId: 10 },
      {
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }
    );
    
    console.log('✅ Response:', response.data);
  } catch (error) {
    console.error('❌ Error response:', error.response?.data);
    console.error('Status:', error.response?.status);
    console.error('Full error:', error.message);
  }
}

triggerInventorySync();
