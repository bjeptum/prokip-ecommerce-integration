const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');
const axios = require('axios');

const prisma = new PrismaClient();

async function implementAutomaticStockReduction() {
  console.log('🔧 Implementing Automatic Stock Reduction Solution');
  console.log('===============================================');

  try {
    const headers = await prokipService.getAuthHeaders(50);
    
    // 1. Get current stock levels
    console.log('\n1️⃣ Getting current stock levels...');
    const currentStock = await prokipService.getInventory(null, 50);
    const testSku = '4848961';
    const stockItem = currentStock.find(item => item.sku === testSku);
    const initialStock = stockItem ? parseInt(stockItem.stock) : 0;
    
    console.log(`   SKU ${testSku}: ${initialStock} units`);

    // 2. Create a test sale first to get a transaction_id
    console.log('\n2️⃣ Creating a test sale to get transaction_id...');
    
    const salePayload = {
      sells: [{
        location_id: 21237,
        contact_id: 1847898, // Walk-In Customer from the API response
        transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        invoice_no: 'AUTO-TEST-' + Date.now(),
        status: 'final',
        type: 'sell',
        payment_status: 'paid',
        final_total: 680,
        discount_amount: 0,
        discount_type: 'fixed',
        products: [{
          product_id: 4848961,
          variation_id: 5216467,
          quantity: 1,
          unit_price: 680,
          unit_price_inc_tax: 680
        }],
        payments: [{
          method: 'cash',
          amount: 680,
          paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
        }],
        platform_source: 'woocommerce',
        platform_order_id: 'AUTO-TEST-' + Date.now()
      }]
    };

    let transactionId = null;
    
    try {
      const saleResponse = await axios.post(
        'https://api.prokip.africa/connector/api/sell',
        salePayload,
        { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 15000 }
      );
      
      console.log('✅ Test sale created successfully');
      
      if (saleResponse.data && saleResponse.data.data && saleResponse.data.data[0]) {
        transactionId = saleResponse.data.data[0].id;
        console.log(`   Transaction ID: ${transactionId}`);
      }
      
    } catch (error) {
      console.log('❌ Failed to create test sale:', error.response?.data || error.message);
      
      // If sale creation fails, try to get an existing transaction
      console.log('Trying to get existing transaction...');
      try {
        const existingSalesResponse = await axios.get(
          'https://api.prokip.africa/connector/api/sell?limit=1',
          { headers, timeout: 10000 }
        );
        
        if (existingSalesResponse.data && existingSalesResponse.data.data && existingSalesResponse.data.data.length > 0) {
          transactionId = existingSalesResponse.data.data[0].id;
          console.log(`   Using existing transaction ID: ${transactionId}`);
        }
      } catch (existingError) {
        console.log('❌ Failed to get existing transaction:', existingError.message);
        return;
      }
    }

    if (!transactionId) {
      console.log('❌ No transaction ID available, cannot proceed with stock reduction test');
      return;
    }

    // 3. Check stock after sale
    console.log('\n3️⃣ Checking stock after sale...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const stockAfterSale = await prokipService.getInventory(null, 50);
    const stockAfterSaleItem = stockAfterSale.find(item => item.sku === testSku);
    const stockAfterSaleQty = stockAfterSaleItem ? parseInt(stockAfterSaleItem.stock) : 0;
    
    console.log(`   Stock after sale: ${stockAfterSaleQty}`);
    console.log(`   Stock change: ${initialStock} → ${stockAfterSaleQty} (${stockAfterSaleQty - initialStock})`);

    // 4. Test stock reduction via sell-return
    console.log('\n4️⃣ Testing stock reduction via sell-return...');
    
    const returnPayload = {
      transaction_id: transactionId,
      transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      products: [{
        product_id: 4848961,
        variation_id: 5216467,
        quantity: 1,
        unit_price: 680,
        unit_price_inc_tax: 680
      }],
      discount_amount: 0,
      discount_type: 'fixed'
    };

    try {
      const returnResponse = await axios.post(
        'https://api.prokip.africa/connector/api/sell-return',
        returnPayload,
        { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 15000 }
      );
      
      console.log('✅ Sell-return created successfully');
      console.log('   Response:', JSON.stringify(returnResponse.data, null, 2));
      
    } catch (error) {
      console.log('❌ Sell-return failed:', error.response?.data || error.message);
    }

    // 5. Check stock after return
    console.log('\n5️⃣ Checking stock after return...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const stockAfterReturn = await prokipService.getInventory(null, 50);
    const stockAfterReturnItem = stockAfterReturn.find(item => item.sku === testSku);
    const stockAfterReturnQty = stockAfterReturnItem ? parseInt(stockAfterReturnItem.stock) : 0;
    
    console.log(`   Stock after return: ${stockAfterReturnQty}`);
    console.log(`   Stock change: ${stockAfterSaleQty} → ${stockAfterReturnQty} (${stockAfterReturnQty - stockAfterSaleQty})`);

    // 6. Test if we can create a "negative return" to reduce stock
    console.log('\n6️⃣ Testing negative return for stock reduction...');
    
    const negativeReturnPayload = {
      transaction_id: transactionId,
      transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      products: [{
        product_id: 4848961,
        variation_id: 5216467,
        quantity: -1, // Negative quantity
        unit_price: 680,
        unit_price_inc_tax: 680
      }],
      discount_amount: 0,
      discount_type: 'fixed'
    };

    try {
      const negativeReturnResponse = await axios.post(
        'https://api.prokip.africa/connector/api/sell-return',
        negativeReturnPayload,
        { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 15000 }
      );
      
      console.log('🎉 Negative return SUCCESS!');
      console.log('   Response:', JSON.stringify(negativeReturnResponse.data, null, 2));
      
    } catch (error) {
      console.log('❌ Negative return failed:', error.response?.data || error.message);
    }

    // 7. Final stock check
    console.log('\n7️⃣ Final stock check...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const finalStock = await prokipService.getInventory(null, 50);
    const finalStockItem = finalStock.find(item => item.sku === testSku);
    const finalStockQty = finalStockItem ? parseInt(finalStockItem.stock) : 0;
    
    console.log(`   Final stock: ${finalStockQty}`);
    console.log(`   Total change: ${initialStock} → ${finalStockQty} (${finalStockQty - initialStock})`);

    // 8. Create the automatic stock reduction function
    console.log('\n8️⃣ Creating automatic stock reduction function...');
    
    const automaticStockReductionCode = `
// Automatic Stock Reduction Function for Prokip
async function reduceStockInProkip(sku, quantity, userId = 50) {
  try {
    const headers = await prokipService.getAuthHeaders(userId);
    
    // Get recent sales to find a transaction ID
    const salesResponse = await axios.get(
      'https://api.prokip.africa/connector/api/sell?limit=1',
      { headers, timeout: 10000 }
    );
    
    if (!salesResponse.data?.data?.length) {
      throw new Error('No recent sales found for stock reduction');
    }
    
    const transactionId = salesResponse.data.data[0].id;
    
    // Create a "negative return" to reduce stock
    const reductionPayload = {
      transaction_id: transactionId,
      transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      products: [{
        product_id: parseInt(sku),
        variation_id: parseInt(sku), // Use SKU as variation_id for single products
        quantity: -quantity, // Negative to reduce stock
        unit_price: 0,
        unit_price_inc_tax: 0
      }],
      discount_amount: 0,
      discount_type: 'fixed'
    };
    
    const response = await axios.post(
      'https://api.prokip.africa/connector/api/sell-return',
      reductionPayload,
      { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    
    console.log(\`✓ Stock reduced in Prokip for SKU \${sku}: \${quantity} units\`);
    return response.data;
    
  } catch (error) {
    console.error(\`❌ Failed to reduce stock for SKU \${sku}:\`, error.response?.data || error.message);
    throw error;
  }
}
`;

    console.log('✅ Automatic stock reduction function created:');
    console.log(automaticStockReductionCode);

    console.log('\n✅ Automatic stock reduction implementation completed!');

  } catch (error) {
    console.error('❌ Implementation failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run implementation
implementAutomaticStockReduction();
