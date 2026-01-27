const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testStockDeduction() {
  try {
    console.log('🔄 Testing WooCommerce → Prokip stock deduction...');
    
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
    
    // Step 1: Check current Prokip inventory
    console.log('\n📦 Step 1: Checking current Prokip inventory...');
    const inventoryResponse = await axios.get('http://localhost:3000/prokip/inventory', {
      headers
    });
    
    const inventory = inventoryResponse.data.inventory || [];
    console.log(`Found ${inventory.length} products in Prokip inventory`);
    
    // Find a product with stock to test
    const testProduct = inventory.find(item => item.stock > 0);
    if (!testProduct) {
      console.log('❌ No products with stock found for testing');
      return;
    }
    
    console.log(`✅ Test product found: ${testProduct.name} (SKU: ${testProduct.sku}, Stock: ${testProduct.stock})`);
    
    // Step 2: Check current sales log
    console.log('\n📋 Step 2: Checking current sales log...');
    const salesLogResponse = await axios.get('http://localhost:3000/sync/sales-log', {
      headers
    });
    
    const salesLog = salesLogResponse.data.sales || [];
    console.log(`Current sales log entries: ${salesLog.length}`);
    
    // Step 3: Trigger order sync to process WooCommerce orders
    console.log('\n🔄 Step 3: Triggering order sync...');
    const syncResponse = await axios.post('http://localhost:3000/sync/pull-sales', {
      connectionId: 5
    }, {
      headers
    });
    
    console.log(`Sync result: ${syncResponse.data.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Orders processed: ${syncResponse.data.ordersProcessed || 0}`);
    
    // Step 4: Check if sales were created
    console.log('\n📋 Step 4: Checking if sales were created...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    const newSalesLogResponse = await axios.get('http://localhost:3000/sync/sales-log', {
      headers
    });
    
    const newSalesLog = newSalesLogResponse.data.sales || [];
    console.log(`New sales log entries: ${newSalesLog.length}`);
    
    if (newSalesLog.length > salesLog.length) {
      console.log('✅ New sales were created!');
      const newSales = newSalesLog.slice(salesLog.length);
      newSales.forEach((sale, index) => {
        console.log(`${index + 1}. Order #${sale.orderId} - ${sale.totalAmount} - ${sale.status}`);
      });
    } else {
      console.log('❌ No new sales were created');
    }
    
    // Step 5: Check if Prokip stock was deducted
    console.log('\n📦 Step 5: Checking if Prokip stock was deducted...');
    const newInventoryResponse = await axios.get('http://localhost:3000/prokip/inventory', {
      headers
    });
    
    const newInventory = newInventoryResponse.data.inventory || [];
    const updatedProduct = newInventory.find(item => item.sku === testProduct.sku);
    
    if (updatedProduct) {
      if (updatedProduct.stock < testProduct.stock) {
        console.log(`✅ Stock deducted! Before: ${testProduct.stock}, After: ${updatedProduct.stock}`);
      } else {
        console.log(`❌ Stock not deducted. Before: ${testProduct.stock}, After: ${updatedProduct.stock}`);
      }
    } else {
      console.log('❌ Test product not found in new inventory');
    }
    
    // Step 6: Check backend logs for errors
    console.log('\n🔍 Step 6: Analysis...');
    console.log('If stock was not deducted, possible issues:');
    console.log('1. Order payment status check failed');
    console.log('2. Duplicate order check prevented processing');
    console.log('3. Insufficient inventory warning');
    console.log('4. Prokip API call failed');
    console.log('5. Order mapping failed');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testStockDeduction();
