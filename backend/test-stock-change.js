const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testStockChange() {
  try {
    console.log('🔄 Testing stock change detection and update...');
    
    // Get Prokip config for authentication
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });
    
    if (!prokipConfig?.token) {
      console.log('No Prokip config found');
      return;
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`
    };
    
    // Get current state
    const beforeResponse = await axios.get('http://localhost:3000/stores/my-store/products?connectionId=5', {
      headers
    });
    
    const hairCream = beforeResponse.data.products?.find(p => p.sku === '4848961');
    if (!hairCream) {
      console.log('❌ Hair cream not found');
      return;
    }
    
    console.log(`📦 Current Hair cream stock: ${hairCream.stock_quantity}`);
    
    // Force inventory sync
    console.log('\n🔄 Forcing inventory sync...');
    const syncResponse = await axios.post('http://localhost:3000/sync/inventory', {
      connectionId: 5
    }, {
      headers
    });
    
    console.log(`Sync result: ${syncResponse.data.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Products processed: ${syncResponse.data.results?.length || 0}`);
    
    // Check results
    const hairCreamResult = syncResponse.data.results?.find(r => r.sku === '4848961');
    if (hairCreamResult) {
      console.log(`📦 Hair cream sync: ${hairCreamResult.status}`);
      console.log(`📊 New quantity: ${hairCreamResult.quantity}`);
    }
    
    // Wait and verify
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const afterResponse = await axios.get('http://localhost:3000/stores/my-store/products?connectionId=5', {
      headers
    });
    
    const hairCreamAfter = afterResponse.data.products?.find(p => p.sku === '4848961');
    if (hairCreamAfter) {
      console.log(`📦 Hair cream stock after sync: ${hairCreamAfter.stock_quantity}`);
      
      if (parseInt(hairCreamAfter.stock_quantity) === parseInt(hairCreamResult.quantity)) {
        console.log('✅ SUCCESS! Stock updated correctly');
      } else {
        console.log('❌ FAILED! Stock mismatch');
      }
    }
    
    // Test a few more products
    console.log('\n🔍 Testing other products...');
    const testSkus = ['4744942', '4815445', '4848961', '4874349', '4846757'];
    
    for (const sku of testSkus) {
      const product = afterResponse.data.products?.find(p => p.sku === sku);
      const syncResult = syncResponse.data.results?.find(r => r.sku === sku);
      
      if (product && syncResult) {
        const match = parseInt(product.stock_quantity) === parseInt(syncResult.quantity);
        console.log(`${sku}: ${product.name} - ${product.stock_quantity} (${match ? '✅' : '❌'})`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testStockChange();
