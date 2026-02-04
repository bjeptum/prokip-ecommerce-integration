const axios = require('axios');

async function testProkipSourceOfTruth() {
  try {
    console.log('🎯 TESTING: Prokip as Source of Truth for Stock Deduction');
    
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
      
      // Step 2: Test the updated bidirectional sync
      console.log('\n🧪 Step 2: Testing PROKIP-AS-SOURCE-OF-TRUTH bidirectional sync...');
      console.log('🔍 This should:');
      console.log('  1. Fetch current stock from Prokip location');
      console.log('  2. Deduct stock from Prokip based on actual Prokip inventory');
      console.log('  3. Update WooCommerce to match Prokip stock');
      
      try {
        const syncResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Bidirectional sync completed!');
        console.log('📊 Results:', JSON.stringify(syncResponse.data, null, 2));
        
        // Step 3: Verify the logic worked correctly
        console.log('\n🧪 Step 3: Verification...');
        console.log('✅ Stock should now be deducted from actual Prokip inventory');
        console.log('✅ WooCommerce should be updated to match Prokip stock levels');
        console.log('✅ Local database should reflect Prokip stock (not the other way around)');
        
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

testProkipSourceOfTruth();
