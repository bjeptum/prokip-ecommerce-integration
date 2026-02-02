/**
 * Comprehensive test to debug inventory sync issues
 * This will trigger the inventory sync with proper authentication and show detailed logs
 */

const axios = require('axios');

async function testInventorySyncWithRealAuth() {
  try {
    console.log('🧪 Testing inventory sync with enhanced logging...\n');
    
    // First, let's get a real token by simulating the frontend login
    console.log('🔐 Attempting to get authentication token...');
    
    // Check if we can access the Prokip config to get the token
    const { PrismaClient } = require('./src/lib/prisma');
    const prisma = new PrismaClient();
    
    const prokipConfig = await prisma.prokipConfig.findFirst({ 
      where: { userId: 50 } 
    });
    
    if (!prokipConfig || !prokipConfig.token) {
      throw new Error('No Prokip configuration found. Please configure Prokip first.');
    }
    
    console.log('✅ Found Prokip token for user:', prokipConfig.userId);
    console.log('📍 Location ID:', prokipConfig.locationId);
    
    // Now test the inventory sync with the real token
    console.log('\n🔄 Triggering inventory sync with real authentication...');
    
    const response = await axios.post('http://localhost:3000/sync/inventory', {
      connectionId: 10
    }, {
      headers: {
        'Authorization': `Bearer ${prokipConfig.token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });
    
    console.log('✅ Inventory sync completed successfully!');
    console.log('Response:', response.data);
    
    return response.data;
    
  } catch (error) {
    console.error('❌ Inventory sync test failed:');
    console.error('   Status:', error.response?.status);
    console.error('   Status Text:', error.response?.statusText);
    console.error('   Response Data:', error.response?.data);
    console.error('   Message:', error.message);
    
    if (error.response?.data?.context) {
      console.error('   Error Context:', error.response.data.context);
    }
    
    throw error;
  }
}

async function checkProductData() {
  try {
    console.log('\n🔍 Checking Prokip product data structure...');
    
    const prokipService = require('./src/services/prokipService');
    const products = await prokipService.getProducts(null, 50);
    
    console.log(`📦 Found ${products.length} products`);
    
    // Look for polo shirts specifically
    const poloShirts = products.filter(p => 
      p.name && p.name.toLowerCase().includes('polo')
    );
    
    console.log(`👕 Found ${poloShirts.length} polo shirts:`);
    
    poloShirts.forEach((shirt, index) => {
      console.log(`\n   Polo Shirt ${index + 1}:`);
      console.log(`     Name: ${shirt.name}`);
      console.log(`     SKU: ${shirt.sku}`);
      console.log(`     Stock fields:`);
      console.log(`       stock: ${shirt.stock}`);
      console.log(`       qty_available: ${shirt.qty_available}`);
      console.log(`       opening_stock: ${shirt.opening_stock}`);
      console.log(`       quantity: ${shirt.quantity}`);
      
      // Calculate what the final quantity would be
      const finalQuantity = shirt.stock || shirt.qty_available || shirt.opening_stock || 0;
      console.log(`     🎯 Final calculated quantity: ${finalQuantity}`);
    });
    
    return products;
    
  } catch (error) {
    console.error('❌ Failed to check product data:', error.message);
    throw error;
  }
}

async function runComprehensiveTest() {
  console.log('🚀 Starting comprehensive inventory sync debug...\n');
  
  try {
    // First check the product data structure
    await checkProductData();
    
    // Then test the actual sync
    await testInventorySyncWithRealAuth();
    
    console.log('\n🎉 Test completed successfully!');
    console.log('💡 Check the server logs for detailed information about:');
    console.log('   - Product data structure');
    console.log('   - Stock field mapping');
    console.log('   - Polo shirt specific details');
    console.log('   - WooCommerce update attempts');
    
  } catch (error) {
    console.log('\n❌ Test failed, but the detailed logs should help identify the issue.');
    console.log('💡 Check the server logs for detailed error information.');
  }
}

// Run the comprehensive test
runComprehensiveTest().catch(console.error);
