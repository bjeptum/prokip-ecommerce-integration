/**
 * Test using actual variation_id from product variations
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

async function testActualVariationIds() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Testing with actual variation_ids from product...\n');

    // Get configurations
    const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId: 50 } });

    if (!prokipConfig) {
      console.error('❌ Missing Prokip config');
      return;
    }

    // Get Prokip headers
    const prokipHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };

    // Get the specific product that's failing
    const productsResponse = await axios.get('https://api.prokip.africa/connector/api/product?sku=4922924', { headers: prokipHeaders });
    const product = productsResponse.data.data?.[0];
    
    if (!product) {
      console.log('❌ Product 4922924 not found');
      return;
    }

    console.log(`📦 Found product: ${product.name} (Type: ${product.type})`);
    
    // Look for actual variation_ids in the product structure
    let actualVariationId = null;
    
    if (product.product_variations && product.product_variations.length > 0) {
      for (const pv of product.product_variations) {
        if (pv.variations && pv.variations.length > 0) {
          for (const v of pv.variations) {
            if (v.variation_id && v.variation_id !== undefined) {
              actualVariationId = v.variation_id;
              console.log(`✅ Found actual variation_id: ${actualVariationId}`);
              break;
            }
          }
          if (actualVariationId) break;
        }
      }
    }
    
    if (!actualVariationId) {
      console.log('❌ No valid variation_id found, trying to create a simple sale without variation_id');
      
      // Try creating a sale with just the essential fields
      const simpleSellBody = {
        sells: [{
          location_id: parseInt(prokipConfig.locationId),
          contact_id: 1849984,
          transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
          invoice_no: `SIMPLE-${Date.now()}`,
          status: 'final',
          type: 'sell',
          payment_status: 'paid',
          final_total: 100,
          products: [{
            name: product.name,
            sku: product.sku,
            quantity: 1,
            unit_price: 100,
            total_price: 100,
            product_id: product.id
          }],
          payments: [{
            method: 'test',
            amount: 100,
            paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
          }]
        }]
      };

      console.log('📝 Trying simple sale without variation_id...');
      try {
        const response = await axios.post('https://api.prokip.africa/connector/api/sell', simpleSellBody, { headers: prokipHeaders });
        
        if (response.data && response.data.length > 0 && !response.data[0].original?.error) {
          console.log('✅ SUCCESS! Simple sale worked');
          console.log('Response:', JSON.stringify(response.data, null, 2));
        } else {
          console.log('❌ Simple sale failed:', response.data[0]?.original?.error?.message);
        }
      } catch (error) {
        console.log('❌ Simple sale error:', error.response?.data?.[0]?.original?.error?.message);
      }
      
    } else {
      // Test with the actual variation_id
      const sellBody = {
        sells: [{
          location_id: parseInt(prokipConfig.locationId),
          contact_id: 1849984,
          transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
          invoice_no: `REAL-VAR-${Date.now()}`,
          status: 'final',
          type: 'sell',
          payment_status: 'paid',
          final_total: 100,
          products: [{
            name: product.name,
            sku: product.sku,
            quantity: 1,
            unit_price: 100,
            total_price: 100,
            product_id: product.id,
            variation_id: actualVariationId
          }],
          payments: [{
            method: 'test',
            amount: 100,
            paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
          }]
        }]
      };

      console.log(`📝 Trying with actual variation_id: ${actualVariationId}`);
      try {
        const response = await axios.post('https://api.prokip.africa/connector/api/sell', sellBody, { headers: prokipHeaders });
        
        if (response.data && response.data.length > 0 && !response.data[0].original?.error) {
          console.log('✅ SUCCESS! Real variation_id worked');
          console.log('Response:', JSON.stringify(response.data, null, 2));
        } else {
          console.log('❌ Real variation_id failed:', response.data[0]?.original?.error?.message);
        }
      } catch (error) {
        console.log('❌ Real variation_id error:', error.response?.data?.[0]?.original?.error?.message);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testActualVariationIds();
