const axios = require('axios');

async function testWooCommerceToProkipStockDeduction() {
  try {
    console.log('🎯 TESTING: WooCommerce Sales → Prokip Stock Deduction');
    
    // Login to get token
    const loginResponse = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'Myifrit37942949#'
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.token;
      console.log('✅ Login successful, token present');
      
      // Step 1: Clear the sales log to re-process the order
      console.log('\n🧪 Step 1: Clearing sales log for order #14223...');
      const prisma = require('./src/lib/prisma');
      
      const existingLog = await prisma.salesLog.findFirst({
        where: {
          connectionId: 1,
          orderId: '14223'
        }
      });
      
      if (existingLog) {
        await prisma.salesLog.delete({
          where: { id: existingLog.id }
        });
        console.log('✅ Sales log cleared - order will be processed again');
      } else {
        console.log('ℹ️ No sales log found - order will be processed fresh');
      }
      
      // Step 2: Check current Prokip stock for the products
      console.log('\n🧪 Step 2: Checking current Prokip stock...');
      try {
        const stockResponse = await axios.get('http://localhost:3000/prokip/inventory', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        const skus = ['4987009', '4935029'];
        console.log('📊 Current Prokip stock:');
        skus.forEach(sku => {
          const item = stockResponse.data.find(i => i.sku === sku);
          if (item) {
            console.log(`  - ${sku}: ${item.stock} units`);
          } else {
            console.log(`  - ${sku}: NOT FOUND in Prokip`);
          }
        });
        
      } catch (stockError) {
        console.error('❌ Failed to check Prokip stock:', stockError.response?.data || stockError.message);
      }
      
      // Step 3: Run bidirectional sync to process WooCommerce order
      console.log('\n🧪 Step 3: Running bidirectional sync...');
      console.log('🔍 This should:');
      console.log('  1. Detect WooCommerce order #14223');
      console.log('  2. Deduct stock from Prokip');
      console.log('  3. Update WooCommerce stock');
      
      try {
        const syncResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Bidirectional sync completed!');
        console.log('📊 Results:', JSON.stringify(syncResponse.data, null, 2));
        
        // Step 4: Check Prokip stock again to see if it was deducted
        console.log('\n🧪 Step 4: Checking Prokip stock after sync...');
        try {
          const stockResponse = await axios.get('http://localhost:3000/prokip/inventory', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log('📊 Prokip stock AFTER sync:');
          skus.forEach(sku => {
            const item = stockResponse.data.find(i => i.sku === sku);
            if (item) {
              console.log(`  - ${sku}: ${item.stock} units`);
            } else {
              console.log(`  - ${sku}: NOT FOUND in Prokip`);
            }
          });
          
        } catch (stockError) {
          console.error('❌ Failed to check final Prokip stock:', stockError.response?.data || stockError.message);
        }
        
      } catch (syncError) {
        console.error('❌ Bidirectional sync failed:', syncError.response?.data || syncError.message);
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

testWooCommerceToProkipStockDeduction();
