const axios = require('axios');

async function testStockDeduction() {
  try {
    console.log('🧪 Testing stock deduction mechanism...');
    
    // Login to get token
    const loginResponse = await axios.post('http://localhost:3000/auth/prokip-login', {
      username: 'kenditrades',
      password: 'Myifrit37942949#'
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.token;
      console.log('✅ Login successful, token present');
      
      // Check current stock levels
      console.log('\n🧪 Checking current stock levels...');
      try {
        const stockResponse = await axios.get('http://localhost:3000/prokip/inventory', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('📊 Current stock levels:');
        stockResponse.data.slice(0, 5).forEach(item => {
          console.log(`- ${item.sku}: ${item.stock} units`);
        });
        
      } catch (stockError) {
        console.error('❌ Failed to check stock:', stockError.response?.data || stockError.message);
      }
      
      // Test the direct stock deduction function
      console.log('\n🧪 Testing direct Prokip stock deduction...');
      try {
        const prokipService = require('./src/services/prokipService');
        
        const testProducts = [{
          product_id: 4922111, // Marida Foundation
          quantity: 1
        }];
        
        console.log('🔧 Attempting to deduct 1 unit from product 4922111...');
        
        const deductionResult = await prokipService.deductStockFromProkip(
          testProducts,
          21237, // location ID
          'Test stock deduction',
          2 // user ID
        );
        
        console.log('✅ Stock deduction successful!');
        console.log('📊 Result:', deductionResult);
        
      } catch (deductError) {
        console.error('❌ Stock deduction failed:', deductError.message);
      }
      
    } else {
      console.log('❌ Login failed');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testStockDeduction();
