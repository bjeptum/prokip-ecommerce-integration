/**
 * Create a test sale in Prokip to verify sync functionality
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

async function createTestSale() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Creating test sale in Prokip...\n');

    // Get Prokip config
    const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId: 50 } });
    if (!prokipConfig?.token || !prokipConfig.locationId) {
      console.error('❌ No Prokip config found');
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };

    // Get products to use in test sale
    console.log('📦 Getting available products...');
    const productsResponse = await axios.get('https://api.prokip.africa/connector/api/product?per_page=5', { headers });
    const products = productsResponse.data.data || [];
    
    if (products.length === 0) {
      console.error('❌ No products found');
      return;
    }

    console.log(`✅ Found ${products.length} products`);
    const testProduct = products[0];
    console.log(`Using product: ${testProduct.name} (SKU: ${testProduct.sku})`);
    console.log('Product details:', JSON.stringify(testProduct, null, 2));

    // Get correct variation_id
    let variationId = testProduct.id;
    if (testProduct.variations && testProduct.variations.length > 0) {
      const firstVariation = testProduct.variations[0];
      if (firstVariation && firstVariation.variation_id) {
        variationId = firstVariation.variation_id;
      }
    } else if (testProduct.type === 'single' && testProduct.sku === '4744824') {
      variationId = 5291257; // Known variation ID from existing code
    }
    
    console.log(`Using variation_id: ${variationId}`);

    // Create test sale
    const saleBody = {
      sells: [{
        location_id: parseInt(prokipConfig.locationId),
        contact_id: 1849984, // Valid contact ID from existing code
        transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        invoice_no: `TEST-${Date.now()}`,
        status: 'final',
        type: 'sell',
        payment_status: 'paid',
        final_total: 100.00,
        products: [{
          name: testProduct.name,
          sku: testProduct.sku,
          quantity: 1,
          unit_price: 100.00,
          total_price: 100.00,
          product_id: testProduct.id,
          variation_id: variationId
        }],
        payments: [{
          method: 'test',
          amount: 100.00,
          paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
        }]
      }]
    };

    console.log('\n📝 Creating test sale...');
    console.log('Sale data:', JSON.stringify(saleBody, null, 2));

    const response = await axios.post('https://api.prokip.africa/connector/api/sell', saleBody, { headers });
    
    if (response.data && response.data.data && response.data.data.length > 0) {
      const saleId = response.data.data[0].id;
      console.log(`✅ Test sale created successfully! Sale ID: ${saleId}`);
      
      // Now test the bidirectional sync to see if it picks up this sale
      console.log('\n🔄 Testing bidirectional sync...');
      
      // Call the sync endpoint
      const syncResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${prokipConfig.token}`
        }
      });
      
      console.log('📊 Sync response:', JSON.stringify(syncResponse.data, null, 2));
      
    } else {
      console.log('❌ Failed to create test sale');
      console.log('Response data:', JSON.stringify(response.data, null, 2));
      
      // Check if there's an error in the response
      if (response.data && response.data.length > 0 && response.data[0].original) {
        console.log('Error details:', JSON.stringify(response.data[0].original, null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Error creating test sale:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createTestSale();
