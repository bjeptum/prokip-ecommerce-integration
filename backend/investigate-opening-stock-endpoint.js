const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');
const axios = require('axios');

const prisma = new PrismaClient();

async function investigateOpeningStockEndpoint() {
  console.log('🔍 Investigating /opening-stock/save Endpoint');
  console.log('===========================================');

  try {
    const headers = await prokipService.getAuthHeaders(50);
    
    // 1. Test different HTTP methods for /opening-stock/save
    console.log('\n1️⃣ Testing different HTTP methods for /opening-stock/save...');
    
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    const testPayload = {
      location_id: 21237,
      opening_stock_date: new Date().toISOString().slice(0, 10),
      products: [{
        product_id: 4848961,
        quantity: 69
      }]
    };

    for (const method of methods) {
      try {
        const response = await axios({
          method,
          url: 'https://api.prokip.africa/opening-stock/save',
          data: method !== 'GET' ? testPayload : undefined,
          headers: { ...headers, 'Content-Type': 'application/json' },
          timeout: 10000
        });
        
        console.log(`🎉 ${method} /opening-stock/save SUCCESS!`);
        console.log('   Response:', JSON.stringify(response.data, null, 2));
        
        // Check if stock changed
        await new Promise(resolve => setTimeout(resolve, 3000));
        const stockAfter = await prokipService.getInventory(null, 50);
        const stockItem = stockAfter.find(item => item.sku === '4848961');
        console.log(`   Stock after ${method}: ${stockItem ? stockItem.stock : 'Not found'}`);
        
      } catch (error) {
        console.log(`❌ ${method} /opening-stock/save: ${error.response?.status || 'ERROR'}`);
      }
    }

    // 2. Test /stock-adjustments with different authentication
    console.log('\n2️⃣ Testing /stock-adjustments with different auth...');
    
    // The 401 error suggests authentication issue, let's try different auth headers
    const authVariations = [
      headers, // Current auth
      { ...headers, 'Accept': 'application/json' }, // With Accept header
      { 'Authorization': headers.Authorization, 'Content-Type': 'application/json' }, // Minimal auth
    ];

    for (let i = 0; i < authVariations.length; i++) {
      try {
        const testPayload = {
          location_id: 21237,
          adjustment_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
          reason: 'Test stock adjustment',
          products: [{
            product_id: 4848961,
            quantity: -1
          }]
        };

        const response = await axios.post(
          'https://api.prokip.africa/stock-adjustments',
          testPayload,
          { headers: authVariations[i], timeout: 10000 }
        );
        
        console.log(`🎉 Auth variation ${i + 1} SUCCESS!`);
        console.log('   Response:', JSON.stringify(response.data, null, 2));
        
        break; // Stop at first success
        
      } catch (error) {
        console.log(`❌ Auth variation ${i + 1}: ${error.response?.status || 'ERROR'}`);
      }
    }

    // 3. Test opening-stock without /save
    console.log('\n3️⃣ Testing /opening-stock endpoint...');
    
    try {
      const response = await axios.post(
        'https://api.prokip.africa/opening-stock',
        {
          location_id: 21237,
          opening_stock_date: new Date().toISOString().slice(0, 10),
          products: [{
            product_id: 4848961,
            quantity: 69
          }]
        },
        { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 10000 }
      );
      
      console.log('🎉 /opening-stock SUCCESS!');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      console.log(`❌ /opening-stock: ${error.response?.status || 'ERROR'}`);
    }

    // 4. Test if we can use opening-stock to set exact stock levels
    console.log('\n4️⃣ Testing opening-stock for exact stock setting...');
    
    const currentStock = await prokipService.getInventory(null, 50);
    const stockItem = currentStock.find(item => item.sku === '4848961');
    const currentQuantity = stockItem ? parseInt(stockItem.stock) : 0;
    
    console.log(`   Current stock: ${currentQuantity}`);
    
    // Try to reduce stock by setting opening stock to current - 1
    try {
      const setStockPayload = {
        location_id: 21237,
        opening_stock_date: new Date().toISOString().slice(0, 10),
        products: [{
          product_id: 4848961,
          quantity: Math.max(0, currentQuantity - 1) // Reduce by 1
        }]
      };

      const response = await axios.post(
        'https://api.prokip.africa/opening-stock',
        setStockPayload,
        { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 15000 }
      );
      
      console.log('🎉 Stock setting via opening-stock SUCCESS!');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      
      // Check if stock actually changed
      await new Promise(resolve => setTimeout(resolve, 3000));
      const stockAfter = await prokipService.getInventory(null, 50);
      const stockAfterItem = stockAfter.find(item => item.sku === '4848961');
      const newQuantity = stockAfterItem ? parseInt(stockAfterItem.stock) : 0;
      
      console.log(`   Stock after setting: ${newQuantity}`);
      console.log(`   Change: ${currentQuantity} → ${newQuantity} (${newQuantity - currentQuantity})`);
      
      if (newQuantity < currentQuantity) {
        console.log('🎉 AUTOMATIC STOCK REDUCTION IS WORKING!');
        
        // Create the working function
        await createWorkingStockReductionFunction();
      }
      
    } catch (error) {
      console.log(`❌ Stock setting failed:`, error.response?.data?.message || error.message);
    }

    console.log('\n✅ Opening stock endpoint investigation completed!');

  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function createWorkingStockReductionFunction() {
  console.log('\n🔧 Creating working stock reduction function...');
  
  const workingFunction = `
/**
 * Working Stock Reduction Function for Prokip
 * Uses opening-stock endpoint to set exact stock levels
 */
async function reduceStockInProkip(sku, quantity, userId = null) {
  try {
    const headers = await getAuthHeaders(userId);
    
    // Get current stock level
    const currentStock = await getInventory(null, userId);
    const stockItem = currentStock.find(item => item.sku === sku);
    
    if (!stockItem) {
      throw new Error(\`Product SKU \${sku} not found in inventory\`);
    }
    
    const currentQuantity = parseInt(stockItem.stock);
    const newQuantity = Math.max(0, currentQuantity - quantity);
    
    // Use opening-stock to set the new stock level
    const payload = {
      location_id: 21237,
      opening_stock_date: new Date().toISOString().slice(0, 10),
      products: [{
        product_id: parseInt(sku),
        quantity: newQuantity
      }]
    };
    
    const response = await axios.post(
      'https://api.prokip.africa/opening-stock',
      payload,
      { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    
    console.log(\`✓ Stock reduced in Prokip for SKU \${sku}: \${currentQuantity} → \${newQuantity}\`);
    return { success: true, oldStock: currentQuantity, newStock: newQuantity, response: response.data };
    
  } catch (error) {
    console.error(\`❌ Failed to reduce stock for SKU \${sku}:\`, error.response?.data || error.message);
    throw error;
  }
}
`;

  console.log('✅ Working stock reduction function created:');
  console.log(workingFunction);
}

// Run the investigation
investigateOpeningStockEndpoint();
