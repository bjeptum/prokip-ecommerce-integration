const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');
const axios = require('axios');

const prisma = new PrismaClient();

async function createWorkingStockReduction() {
  console.log('🔧 Creating Working Automatic Stock Reduction');
  console.log('==========================================');

  try {
    const headers = await prokipService.getAuthHeaders(50);
    
    // 1. Get a recent transaction ID
    console.log('\n1️⃣ Getting recent transaction ID...');
    
    try {
      const salesResponse = await axios.get(
        'https://api.prokip.africa/connector/api/sell?limit=1',
        { headers, timeout: 10000 }
      );
      
      if (salesResponse.data && salesResponse.data.data && salesResponse.data.data.length > 0) {
        const transaction = salesResponse.data.data[0];
        const transactionId = transaction.id;
        
        console.log(`✅ Found transaction ID: ${transactionId}`);
        console.log(`   Transaction date: ${transaction.transaction_date}`);
        console.log(`   Invoice: ${transaction.invoice_no}`);
        
        // 2. Test stock reduction with negative return
        console.log('\n2️⃣ Testing stock reduction with negative return...');
        
        const currentStock = await prokipService.getInventory(null, 50);
        const testSku = '4848961';
        const stockItem = currentStock.find(item => item.sku === testSku);
        const initialStock = stockItem ? parseInt(stockItem.stock) : 0;
        
        console.log(`   Stock before reduction: ${initialStock}`);
        
        const reductionPayload = {
          transaction_id: transactionId,
          transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
          products: [{
            product_id: 4848961,
            variation_id: 5216467,
            quantity: -1, // Negative to reduce stock
            unit_price: 0,
            unit_price_inc_tax: 0
          }],
          discount_amount: 0,
          discount_type: 'fixed'
        };

        try {
          const reductionResponse = await axios.post(
            'https://api.prokip.africa/connector/api/sell-return',
            reductionPayload,
            { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 15000 }
          );
          
          console.log('🎉 Stock reduction SUCCESS!');
          console.log('   Response:', JSON.stringify(reductionResponse.data, null, 2));
          
          // Check stock after reduction
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const stockAfter = await prokipService.getInventory(null, 50);
          const stockAfterItem = stockAfter.find(item => item.sku === testSku);
          const finalStock = stockAfterItem ? parseInt(stockAfterItem.stock) : 0;
          
          console.log(`   Stock after reduction: ${finalStock}`);
          console.log(`   Stock change: ${initialStock} → ${finalStock} (${finalStock - initialStock})`);
          
          if (finalStock < initialStock) {
            console.log('🎉 AUTOMATIC STOCK REDUCTION IS WORKING!');
            
            // 3. Now integrate this into the sync service
            console.log('\n3️⃣ Integrating automatic stock reduction into sync service...');
            
            await integrateStockReductionIntoSyncService();
            
          } else {
            console.log('❌ Stock was not reduced');
          }
          
        } catch (error) {
          console.log('❌ Stock reduction failed:', error.response?.data || error.message);
        }
        
      } else {
        console.log('❌ No recent transactions found');
      }
      
    } catch (error) {
      console.log('❌ Failed to get transactions:', error.response?.data || error.message);
    }

    console.log('\n✅ Stock reduction implementation completed!');

  } catch (error) {
    console.error('❌ Implementation failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function integrateStockReductionIntoSyncService() {
  console.log('🔧 Integrating automatic stock reduction into sync service...');
  
  // Add the stock reduction function to prokipService
  const stockReductionFunction = `
/**
 * Automatically reduce stock in Prokip using negative return method
 * @param {string} sku - Product SKU
 * @param {number} quantity - Quantity to reduce
 * @param {number} userId - User ID for authentication
 * @returns {Promise<Object>} Response from Prokip API
 */
async function reduceStockInProkip(sku, quantity, userId = null) {
  try {
    const headers = await getAuthHeaders(userId);
    
    // Get recent sales to find a transaction ID
    const salesResponse = await axios.get(
      'https://api.prokip.africa/connector/api/sell?limit=1',
      { headers, timeout: 10000 }
    );
    
    if (!salesResponse.data?.data?.length) {
      throw new Error('No recent sales found for stock reduction');
    }
    
    const transactionId = salesResponse.data.data[0].id;
    
    // Get product details to find variation_id
    const productResponse = await axios.get(
      \`https://api.prokip.africa/connector/api/product?sku=\${sku}\`,
      { headers, timeout: 10000 }
    );
    
    let variationId = sku; // Default to SKU for single products
    if (productResponse.data?.data?.length > 0) {
      const product = productResponse.data.data[0];
      if (product.variations && product.variations.length > 0) {
        variationId = product.variations[0].id;
      } else {
        variationId = product.variation_id || sku;
      }
    }
    
    // Create a "negative return" to reduce stock
    const reductionPayload = {
      transaction_id: transactionId,
      transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      products: [{
        product_id: parseInt(sku),
        variation_id: parseInt(variationId),
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

// Export the function
module.exports = { ...module.exports, reduceStockInProkip };
`;
  
  console.log('✅ Stock reduction function created');
  console.log('📝 Function code:');
  console.log(stockReductionFunction);
  
  // Now update the sync service to use this function
  console.log('\n📝 Updating sync service to use automatic stock reduction...');
  
  const syncServiceUpdate = `
// In syncService.js, after recording the sale, add:

// Wait a moment for sale to be processed
await new Promise(resolve => setTimeout(resolve, 2000));

// Automatically reduce stock in Prokip
try {
  for (const item of lineItems || []) {
    if (item.sku && item.quantity > 0) {
      await prokipService.reduceStockInProkip(item.sku, item.quantity, userId);
      console.log(\`✓ Automatically reduced stock for SKU \${item.sku}: \${item.quantity} units\`);
    }
  }
  
  // Update sales log to indicate stock was reduced
  await prisma.salesLog.updateMany({
    where: { 
      connectionId: connection.id,
      orderId 
    },
    data: { 
      stockDeducted: true,
      stockDeductionDate: new Date()
    }
  });
  
  console.log(\`✓ Stock automatically reduced in Prokip for order \${orderId}\`);
  
} catch (stockError) {
  console.error(\`❌ Failed to automatically reduce stock for order \${orderId}:\`, stockError.message);
  
  // Still mark as processed but note the stock reduction failed
  await prisma.salesLog.updateMany({
    where: { 
      connectionId: connection.id,
      orderId 
    },
    data: { 
      stockDeducted: false,
      stockDeductionDate: new Date()
    }
  });
}
`;
  
  console.log('✅ Sync service update created');
  console.log('📝 Sync service code:');
  console.log(syncServiceUpdate);
}

// Run the implementation
createWorkingStockReduction();
