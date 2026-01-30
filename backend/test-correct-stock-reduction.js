const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');

const prisma = new PrismaClient();

async function testCorrectStockReduction() {
  console.log('🧪 Testing Correct Stock Reduction Method');
  console.log('========================================');

  try {
    // 1. Get current stock from variation_location_details
    console.log('\n1️⃣ Getting current stock from product details...');
    const products = await prokipService.getProducts(null, 50);
    
    const testProduct = products.find(p => p.sku === '4848961');
    if (!testProduct) {
      console.error('❌ Test product not found');
      return;
    }

    // Find the variation and location details
    const variation = testProduct.product_variations[0];
    const locationDetail = variation.variations[0].variation_location_details.find(
      loc => loc.location_id === 21237
    );

    const initialStock = locationDetail ? parseFloat(locationDetail.qty_available) : 0;
    console.log(`   SKU 4848961: ${initialStock} units (from variation_location_details)`);

    // 2. Try to update stock through the product variation endpoint
    console.log('\n2️⃣ Testing stock update via variation endpoint...');
    
    const headers = await prokipService.getAuthHeaders(50);
    const axios = require('axios');
    
    try {
      // Try updating the variation_location_details directly
      const updatePayload = {
        product_id: 4848961,
        product_variation_id: variation.id,
        variation_id: variation.variations[0].id,
        location_id: 21237,
        qty_available: (initialStock - 1).toString()
      };

      const response = await axios.put(
        `https://api.prokip.africa/connector/api/product-variation/${variation.variations[0].id}`,
        updatePayload,
        { headers, timeout: 10000 }
      );
      
      console.log('✅ Variation stock update - SUCCESS');
      console.log('   Response:', response.data);
      
    } catch (error) {
      console.log('❌ Variation stock update - FAILED');
      console.log(`   Error:`, error.response?.data || error.message);
    }

    // 3. Try using the opening stock endpoint
    console.log('\n3️⃣ Testing opening stock endpoint...');
    
    try {
      const openingStockPayload = {
        location_id: 21237,
        product_id: 4848961,
        opening_stock: (initialStock - 1).toString(),
        date: '2026-01-28'
      };

      const response = await axios.post(
        'https://api.prokip.africa/connector/api/opening-stock',
        openingStockPayload,
        { headers, timeout: 10000 }
      );
      
      console.log('✅ Opening stock update - SUCCESS');
      console.log('   Response:', response.data);
      
    } catch (error) {
      console.log('❌ Opening stock update - FAILED');
      console.log(`   Error:`, error.response?.data || error.message);
    }

    // 4. Check if there's a specific stock adjustment endpoint that works
    console.log('\n4️⃣ Testing alternative stock adjustment format...');
    
    try {
      const adjustmentPayload = {
        location_id: 21237,
        transaction_date: '2026-01-28',
        adjustments: [{
          product_id: 4848961,
          variation_id: variation.variations[0].id,
          quantity: -1,
          adjustment_type: 'subtract',
          reason: 'WooCommerce sale'
        }]
      };

      const response = await axios.post(
        'https://api.prokip.africa/connector/api/stock-adjustments',
        adjustmentPayload,
        { headers, timeout: 10000 }
      );
      
      console.log('✅ Alternative stock adjustment - SUCCESS');
      console.log('   Response:', response.data);
      
    } catch (error) {
      console.log('❌ Alternative stock adjustment - FAILED');
      console.log(`   Error:`, error.response?.data || error.message);
    }

    // 5. Check final stock
    console.log('\n5️⃣ Checking final stock...');
    
    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const finalProducts = await prokipService.getProducts(null, 50);
    const finalProduct = finalProducts.find(p => p.sku === '4848961');
    
    if (finalProduct) {
      const finalVariation = finalProduct.product_variations[0];
      const finalLocationDetail = finalVariation.variations[0].variation_location_details.find(
        loc => loc.location_id === 21237
      );
      
      const finalStock = finalLocationDetail ? parseFloat(finalLocationDetail.qty_available) : 0;
      const change = finalStock - initialStock;
      
      console.log(`   SKU 4848961: ${initialStock} → ${finalStock} (${change > 0 ? '+' : ''}${change})`);
      
      if (change < 0) {
        console.log('✅ Stock was successfully reduced!');
      } else {
        console.log('❌ Stock was not reduced');
      }
    }

    console.log('\n✅ Stock reduction testing completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run test
testCorrectStockReduction();
