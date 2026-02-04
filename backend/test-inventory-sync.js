const axios = require('axios');

async function testInventorySync() {
  try {
    console.log('🧪 Testing inventory sync from Prokip to WooCommerce...');
    
    // Login to get token
    const loginResponse = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'Myifrit37942949#'
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.token;
      console.log('✅ Login successful, token present');
      
      // Test inventory sync
      console.log('\n🧪 Testing /sync/inventory...');
      try {
        const syncResponse = await axios.post('http://localhost:3000/sync/inventory', {
          connectionId: 1
        }, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Inventory sync successful!');
        console.log('📊 Response:', JSON.stringify(syncResponse.data, null, 2));
        
        // Show sync details
        if (syncResponse.data.results) {
          const updated = syncResponse.data.results.filter(r => r.status === 'updated').length;
          const errors = syncResponse.data.results.filter(r => r.status === 'error').length;
          
          console.log(`📈 Sync Results: ${updated} updated, ${errors} errors`);
          
          console.log('\n📦 Sample updated products:');
          syncResponse.data.results
            .filter(r => r.status === 'updated')
            .slice(0, 5)
            .forEach(result => {
              console.log(`- ${result.sku}: New Stock=${result.newStock}, Old Stock=${result.oldStock}`);
            });
        }
        
      } catch (syncError) {
        console.error('❌ Inventory sync failed:', syncError.response?.data || syncError.message);
      }
      
    } else {
      console.log('❌ Login failed');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testInventorySync();
