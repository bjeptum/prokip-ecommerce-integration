const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');

const prisma = new PrismaClient();

async function testSellEndpointStockReduction() {
  console.log('🧪 Testing Sell Endpoint Stock Reduction');
  console.log('=======================================');

  try {
    // 1. Get current stock
    console.log('\n1️⃣ Getting current stock levels...');
    const currentStock = await prokipService.getInventory(null, 50);
    
    const testSku = '4848961';
    const stockItem = currentStock.find(item => item.sku === testSku);
    const initialStock = stockItem ? parseInt(stockItem.stock) : 0;
    
    console.log(`   SKU ${testSku}: ${initialStock} units`);

    // 2. Test stock reduction using sell endpoint
    console.log('\n2️⃣ Testing stock reduction via sell endpoint...');
    
    const sellPayload = {
      sells: [{
        invoice_no: 'STOCK-REDUCT-' + Date.now(),
        customer_id: null,
        sell_date: '2026-01-28',
        payment_status: 'paid',
        products: [{
          product_id: 4848961,
          quantity: -1, // Negative quantity for stock reduction
          unit_price: 0
        }]
      }]
    };

    try {
      const axios = require('axios');
      const headers = await prokipService.getAuthHeaders(50);
      
      const response = await axios.post(
        'https://api.prokip.africa/connector/api/sell',
        sellPayload,
        { headers, timeout: 10000 }
      );
      
      console.log('✅ Sell endpoint response received');
      console.log('   Response structure:', JSON.stringify(response.data, null, 2));
      
      // Check if there's an error in the response
      if (response.data && response.data[0] && response.data[0].original && response.data[0].original.error) {
        console.log('⚠️  Error in response:', response.data[0].original.error);
      } else {
        console.log('✅ Stock reduction appears successful');
      }
      
    } catch (error) {
      console.log('❌ Sell endpoint failed:', error.response?.data || error.message);
    }

    // 3. Check stock after reduction
    console.log('\n3️⃣ Checking stock after reduction...');
    
    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const newStock = await prokipService.getInventory(null, 50);
    const newStockItem = newStock.find(item => item.sku === testSku);
    const currentQty = newStockItem ? parseInt(newStockItem.stock) : 0;
    const change = currentQty - initialStock;
    
    console.log(`   SKU ${testSku}: ${initialStock} → ${currentQty} (${change > 0 ? '+' : ''}${change})`);
    
    if (change < 0) {
      console.log('✅ Stock was successfully reduced!');
    } else {
      console.log('❌ Stock was not reduced');
    }

    // 4. Test with proper sale (positive quantity)
    console.log('\n4️⃣ Testing if regular sales reduce stock...');
    
    const regularSellPayload = {
      sells: [{
        invoice_no: 'REGULAR-SALE-' + Date.now(),
        customer_id: null,
        sell_date: '2026-01-28',
        payment_status: 'paid',
        products: [{
          product_id: 4848961,
          quantity: 1, // Positive quantity
          unit_price: 100
        }]
      }]
    };

    try {
      const axios = require('axios');
      const headers = await prokipService.getAuthHeaders(50);
      
      const response = await axios.post(
        'https://api.prokip.africa/connector/api/sell',
        regularSellPayload,
        { headers, timeout: 10000 }
      );
      
      console.log('✅ Regular sale response received');
      
      // Wait and check stock
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const finalStock = await prokipService.getInventory(null, 50);
      const finalStockItem = finalStock.find(item => item.sku === testSku);
      const finalQty = finalStockItem ? parseInt(finalStockItem.stock) : 0;
      const finalChange = finalQty - currentQty;
      
      console.log(`   SKU ${testSku}: ${currentQty} → ${finalQty} (${finalChange > 0 ? '+' : ''}${finalChange})`);
      
      if (finalChange < 0) {
        console.log('✅ Regular sale successfully reduced stock!');
      } else {
        console.log('❌ Regular sale did not reduce stock');
      }
      
    } catch (error) {
      console.log('❌ Regular sale failed:', error.response?.data || error.message);
    }

    console.log('\n✅ Stock reduction testing completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run test
testSellEndpointStockReduction();
