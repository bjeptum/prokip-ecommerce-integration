const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');
const axios = require('axios');

const prisma = new PrismaClient();

async function checkCredentialsAndTestEndpoints() {
  console.log('🔍 Checking Database Credentials and Testing Endpoints');
  console.log('=====================================================');

  try {
    // 1. Check what credentials we have
    console.log('\n1️⃣ Checking database credentials...');
    
    const connections = await prisma.prokipConfig.findMany();
    console.log(`Found ${connections.length} Prokip connections:`);
    
    for (const conn of connections) {
      console.log(`   User ID: ${conn.userId}`);
      console.log(`   Email: ${conn.email}`);
      console.log(`   Location ID: ${conn.locationId}`);
      console.log(`   Has Password: ${conn.password ? 'Yes' : 'No'}`);
      console.log('---');
    }

    // 2. Try with the first available connection
    const connection = connections[0];
    if (!connection) {
      console.log('❌ No Prokip connections found in database');
      return;
    }

    console.log(`\n2️⃣ Testing with connection for User ID: ${connection.userId}`);
    
    // Get current authentication headers
    const headers = await prokipService.getAuthHeaders(connection.userId);
    console.log('✅ Got authentication headers');
    
    // 3. Test the stock-adjustments endpoint with proper authentication
    console.log('\n3️⃣ Testing /stock-adjustments endpoint...');
    
    try {
      // Test GET first
      const getResponse = await axios.get(
        'https://api.prokip.africa/stock-adjustments',
        { headers, timeout: 8000 }
      );
      
      console.log('✅ GET /stock-adjustments SUCCESS!');
      console.log('   Response:', JSON.stringify(getResponse.data, null, 2));
      
    } catch (getError) {
      console.log(`❌ GET /stock-adjustments failed: ${getError.response?.status}`);
      
      // Try POST if GET fails
      try {
        const stockAdjustmentPayload = {
          location_id: connection.locationId || 21237,
          adjustment_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
          reason: 'WooCommerce sale stock reduction',
          final_total: 0,
          products: [{
            product_id: 4848961,
            variation_id: 5216467,
            quantity: -1, // Reduce by 1
            unit_price: 0,
            unit_price_inc_tax: 0
          }]
        };

        const postResponse = await axios.post(
          'https://api.prokip.africa/stock-adjustments',
          stockAdjustmentPayload,
          { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 15000 }
        );
        
        console.log('🎉 POST /stock-adjustments SUCCESS!');
        console.log('   Response:', JSON.stringify(postResponse.data, null, 2));
        
        // Check if stock actually changed
        await new Promise(resolve => setTimeout(resolve, 3000));
        const stockAfter = await prokipService.getInventory(null, connection.userId);
        const stockItem = stockAfter.find(item => item.sku === '4848961');
        console.log(`   Stock after adjustment: ${stockItem ? stockItem.stock : 'Not found'}`);
        
        if (postResponse.status === 200 || postResponse.status === 201) {
          console.log('🎉 AUTOMATIC STOCK ADJUSTMENT IS WORKING!');
          await createWorkingStockAdjustmentFunction();
        }
        
      } catch (postError) {
        console.log(`❌ POST /stock-adjustments failed:`, postError.response?.data?.message || postError.message);
      }
    }

    // 4. Test opening-stock endpoint
    console.log('\n4️⃣ Testing /opening-stock endpoint...');
    
    try {
      const openingStockPayload = {
        location_id: connection.locationId || 21237,
        opening_stock_date: new Date().toISOString().slice(0, 10),
        products: [{
          product_id: 4848961,
          quantity: 68 // Set to desired stock
        }]
      };

      const response = await axios.post(
        'https://api.prokip.africa/opening-stock',
        openingStockPayload,
        { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 15000 }
      );
      
      console.log('🎉 POST /opening-stock SUCCESS!');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      
      // Check if stock changed
      await new Promise(resolve => setTimeout(resolve, 3000));
      const stockAfter = await prokipService.getInventory(null, connection.userId);
      const stockItem = stockAfter.find(item => item.sku === '4848961');
      console.log(`   Stock after opening-stock: ${stockItem ? stockItem.stock : 'Not found'}`);
      
      if (response.status === 200 || response.status === 201) {
        console.log('🎉 AUTOMATIC STOCK SETTING IS WORKING!');
        await createWorkingStockSettingFunction();
      }
      
    } catch (error) {
      console.log(`❌ POST /opening-stock failed:`, error.response?.data?.message || error.message);
    }

    // 5. Test with different endpoint patterns
    console.log('\n5️⃣ Testing alternative endpoint patterns...');
    
    const alternativeEndpoints = [
      '/api/stock-adjustments',
      '/connector/api/stock-adjustments',
      '/stock-adjustment',
      '/api/stock-adjustment',
      '/connector/api/stock-adjustment'
    ];

    for (const endpoint of alternativeEndpoints) {
      try {
        const testPayload = {
          location_id: connection.locationId || 21237,
          product_id: 4848961,
          quantity: -1,
          reason: 'Test adjustment'
        };

        const response = await axios.post(
          `https://api.prokip.africa${endpoint}`,
          testPayload,
          { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 8000 }
        );
        
        console.log(`🎉 ${endpoint} SUCCESS!`);
        console.log('   Response:', JSON.stringify(response.data, null, 2));
        
        break; // Stop at first success
        
      } catch (error) {
        if (error.response?.status !== 404) {
          console.log(`⚠️  ${endpoint}: ${error.response?.status}`);
        }
      }
    }

    console.log('\n✅ Credentials and endpoint testing completed!');

  } catch (error) {
    console.error('❌ Testing failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function createWorkingStockAdjustmentFunction() {
  console.log('\n🔧 Creating working stock adjustment function...');
  
  const workingFunction = `
/**
 * Working Stock Adjustment Function for Prokip
 * Uses /stock-adjustments endpoint
 */
async function adjustStockInProkip(sku, quantity, userId = null) {
  try {
    const headers = await getAuthHeaders(userId);
    const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : await prisma.prokipConfig.findUnique({ where: { id: 1 } });
    
    const payload = {
      location_id: config?.locationId || 21237,
      adjustment_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      reason: 'WooCommerce sale stock reduction',
      final_total: 0,
      products: [{
        product_id: parseInt(sku),
        quantity: -quantity, // Negative to reduce stock
        unit_price: 0,
        unit_price_inc_tax: 0
      }]
    };
    
    const response = await axios.post(
      'https://api.prokip.africa/stock-adjustments',
      payload,
      { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    
    console.log(\`✓ Stock adjusted in Prokip for SKU \${sku}: \${quantity} units\`);
    return response.data;
    
  } catch (error) {
    console.error(\`❌ Failed to adjust stock for SKU \${sku}:\`, error.response?.data || error.message);
    throw error;
  }
}
`;

  console.log('✅ Working stock adjustment function created:');
  console.log(workingFunction);
}

async function createWorkingStockSettingFunction() {
  console.log('\n🔧 Creating working stock setting function...');
  
  const workingFunction = `
/**
 * Working Stock Setting Function for Prokip
 * Uses /opening-stock endpoint to set exact stock levels
 */
async function setStockInProkip(sku, newQuantity, userId = null) {
  try {
    const headers = await getAuthHeaders(userId);
    const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : await prisma.prokipConfig.findUnique({ where: { id: 1 } });
    
    // Get current stock first
    const currentStock = await getInventory(null, userId);
    const stockItem = currentStock.find(item => item.sku === sku);
    const currentQuantity = stockItem ? parseInt(stockItem.stock) : 0;
    
    const payload = {
      location_id: config?.locationId || 21237,
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
    
    console.log(\`✓ Stock set in Prokip for SKU \${sku}: \${currentQuantity} → \${newQuantity}\`);
    return { success: true, oldStock: currentQuantity, newStock: newQuantity, response: response.data };
    
  } catch (error) {
    console.error(\`❌ Failed to set stock for SKU \${sku}:\`, error.response?.data || error.message);
    throw error;
  }
}
`;

  console.log('✅ Working stock setting function created:');
  console.log(workingFunction);
}

// Run the test
checkCredentialsAndTestEndpoints();
