const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function debugProkipProductsEndpoint() {
  try {
    console.log('🔍 DEBUGGING: Prokip products endpoint error');
    console.log('=' .repeat(60));
    
    // Test the exact endpoint the frontend is calling
    console.log('\n🧪 TESTING /PROKIP/PRODUCTS ENDPOINT:');
    console.log('-'.repeat(40));
    
    try {
      const response = await axios.get('http://localhost:3000/prokip/products');
      console.log('✅ Response status:', response.status);
      console.log('📊 Response data:', response.data);
      
      if (response.data.error) {
        console.log('❌ Error in response:', response.data.error);
      }
      
      if (response.data.products) {
        console.log('✅ Products found:', response.data.products.length);
        
        // Look for air cream product
        const airCream = response.data.products.find(p => 
          p.name && p.name.toLowerCase().includes('air cream') ||
          p.sku && p.sku.toLowerCase().includes('air')
        );
        
        if (airCream) {
          console.log('✅ Found air cream:');
          console.log(`   Name: ${airCream.name}`);
          console.log(`   SKU: ${airCream.sku}`);
          console.log(`   Stock: ${airCream.stock || airCream.quantity || 'Not specified'}`);
        } else {
          console.log('❌ Air cream not found in products');
          console.log('💡 Available products:', response.data.products.slice(0, 5).map(p => p.name));
        }
      }
      
    } catch (error) {
      console.log('❌ Endpoint failed:', error.message);
      if (error.response) {
        console.log('Response status:', error.response.status);
        console.log('Response data:', error.response.data);
      }
    }
    
    // Check the backend route that handles this endpoint
    console.log('\n🔍 CHECKING BACKEND ROUTE:');
    console.log('-'.repeat(40));
    
    // Check prokipRoutes.js for the products endpoint
    console.log('Looking for /prokip/products route...');
    
    // Test Prokip API directly
    console.log('\n🛒 TESTING PROKIP API DIRECTLY:');
    console.log('-'.repeat(40));
    
    const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId: 50 } });
    
    if (!prokipConfig?.token) {
      console.log('❌ Prokip config not found');
      return;
    }
    
    const prokipHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };
    
    try {
      const productsResponse = await axios.get('https://api.prokip.africa/connector/api/product?per_page=-1', { headers: prokipHeaders });
      console.log('✅ Prokip API response status:', productsResponse.status);
      console.log('📊 Products count:', productsResponse.data.data ? productsResponse.data.data.length : 'No data');
      
      if (productsResponse.data.data) {
        // Look for air cream
        const airCream = productsResponse.data.data.find(p => 
          p.name && p.name.toLowerCase().includes('air cream') ||
          p.sku && p.sku.toLowerCase().includes('air')
        );
        
        if (airCream) {
          console.log('✅ Found air cream in Prokip:');
          console.log(`   Name: ${airCream.name}`);
          console.log(`   SKU: ${airCream.sku}`);
          console.log(`   ID: ${airCream.id}`);
          
          // Get stock for this product
          try {
            const stockResponse = await axios.get(
              `https://api.prokip.africa/connector/api/product-stock-report?location_id=${prokipConfig.locationId}`,
              { headers: prokipHeaders }
            );
            
            const stockData = Array.isArray(stockResponse.data) ? stockResponse.data : (stockResponse.data.data || []);
            const productStock = stockData.find(s => s.sku === airCream.sku);
            
            if (productStock) {
              console.log(`   Stock: ${productStock.stock || productStock.qty_available || 0}`);
            } else {
              console.log('   Stock: Not found in stock report');
            }
            
          } catch (stockError) {
            console.log('❌ Failed to get stock:', stockError.message);
          }
        } else {
          console.log('❌ Air cream not found in Prokip products');
          console.log('💡 First 5 products:');
          productsResponse.data.data.slice(0, 5).forEach((p, i) => {
            console.log(`   ${i + 1}. ${p.name} (SKU: ${p.sku || 'No SKU'})`);
          });
        }
      }
      
    } catch (error) {
      console.log('❌ Prokip API failed:', error.message);
      if (error.response) {
        console.log('Response status:', error.response.status);
        console.log('Response data:', error.response.data);
      }
    }
    
    // Check frontend error
    console.log('\n🌐 ANALYZING FRONTEND ERROR:');
    console.log('-'.repeat(40));
    console.log('Error: "Could not load products from Prokip"');
    console.log('Location: script.js:193:13 in apiCall function');
    console.log('Trigger: loadProkipProducts function');
    console.log('');
    console.log('This suggests:');
    console.log('1. /prokip/products endpoint is returning an error');
    console.log('2. Frontend is not handling the response correctly');
    console.log('3. Network connectivity issue');
    console.log('4. Authentication issue with Prokip API');
    
    // Test the exact API call the frontend makes
    console.log('\n🧪 TESTING EXACT FRONTEND API CALL:');
    console.log('-'.repeat(40));
    
    try {
      const token = localStorage.getItem('token') || 'test-token';
      console.log('Using token:', token ? 'Present' : 'Missing');
      
      const apiResponse = await axios.get('http://localhost:3000/prokip/products', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ API call successful');
      console.log('📊 Response:', apiResponse.data);
      
    } catch (error) {
      console.log('❌ API call failed:', error.message);
      console.log('This is the error the frontend is seeing!');
    }
    
    console.log('\n💡 SOLUTIONS:');
    console.log('-'.repeat(40));
    console.log('1. Check /prokip/products route in backend');
    console.log('2. Verify Prokip API authentication');
    console.log('3. Check error handling in frontend');
    console.log('4. Ensure consistent product data between endpoints');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugProkipProductsEndpoint();
