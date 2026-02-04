const axios = require('axios');

async function syncInventoryFirst() {
  try {
    console.log('🧪 Step 1: Syncing inventory from Prokip to create inventory logs...');
    
    // Login to get token
    const loginResponse = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'Myifrit37942949#'
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.token;
      console.log('✅ Login successful, token present');
      
      // Sync inventory from Prokip
      try {
        const syncResponse = await axios.post('http://localhost:3000/sync/inventory', {
          connectionId: 1
        }, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Inventory sync completed!');
        console.log('📊 Response:', JSON.stringify(syncResponse.data, null, 2));
        
      } catch (syncError) {
        console.error('❌ Inventory sync failed:', syncError.response?.data || syncError.message);
        return;
      }
      
      // Step 2: Check if inventory logs were created
      console.log('\n🧪 Step 2: Checking if inventory logs were created...');
      const prisma = require('./src/lib/prisma');
      
      const skus = ['4987009', '4935029'];
      for (const sku of skus) {
        const inventoryLog = await prisma.inventoryLog.findFirst({
          where: {
            connectionId: 1,
            sku: sku
          }
        });
        
        if (inventoryLog) {
          console.log(`✅ Inventory log created for SKU ${sku}: ${inventoryLog.quantity} units`);
        } else {
          console.log(`❌ Still no inventory log for SKU ${sku}`);
        }
      }
      
      // Step 3: Now run bidirectional sync to deduct stock
      console.log('\n🧪 Step 3: Running bidirectional sync to deduct stock...');
      try {
        const bidirectionalResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Bidirectional sync completed!');
        console.log('📊 Response:', JSON.stringify(bidirectionalResponse.data, null, 2));
        
      } catch (bidirectionalError) {
        console.error('❌ Bidirectional sync failed:', bidirectionalError.response?.data || bidirectionalError.message);
      }
      
    } else {
      console.log('❌ Login failed');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

syncInventoryFirst();
