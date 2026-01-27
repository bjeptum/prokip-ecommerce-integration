/**
 * Test different variation_id approaches for single products
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

async function testVariationApproaches() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Testing different variation_id approaches...\n');

    // Get configurations
    const [wooConnection, prokipConfig] = await Promise.all([
      prisma.connection.findFirst({ where: { platform: 'woocommerce' } }),
      prisma.prokipConfig.findFirst({ where: { userId: 50 } })
    ]);

    if (!wooConnection || !prokipConfig) {
      console.error('❌ Missing configurations');
      return;
    }

    // Get Prokip headers
    const prokipHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };

    // Get a single product to test with
    const productsResponse = await axios.get('https://api.prokip.africa/connector/api/product?per_page=1', { headers: prokipHeaders });
    const product = productsResponse.data.data[0];
    
    if (!product) {
      console.log('❌ No products found');
      return;
    }

    console.log(`📦 Testing with product: ${product.name} (SKU: ${product.sku}, Type: ${product.type})`);

    // Test different approaches
    const approaches = [
      {
        name: "Approach 1: Use product_id as variation_id",
        variation_id: product.id
      },
      {
        name: "Approach 2: Use null variation_id",
        variation_id: null
      },
      {
        name: "Approach 3: Omit variation_id entirely",
        omit_variation_id: true
      },
      {
        name: "Approach 4: Use 0 as variation_id",
        variation_id: 0
      }
    ];

    for (const approach of approaches) {
      console.log(`\n🧪 ${approach.name}`);
      
      const sellBody = {
        sells: [{
          location_id: parseInt(prokipConfig.locationId),
          contact_id: 1849984,
          transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
          invoice_no: `TEST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
            ...(approach.omit_variation_id ? {} : { variation_id: approach.variation_id })
          }],
          payments: [{
            method: 'test',
            amount: 100,
            paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
          }]
        }]
      };

      console.log('📝 Sale data:', JSON.stringify(sellBody.sells[0].products[0], null, 2));

      try {
        const response = await axios.post('https://api.prokip.africa/connector/api/sell', sellBody, { headers: prokipHeaders });
        
        if (response.data && response.data.length > 0 && !response.data[0].original?.error) {
          console.log('✅ SUCCESS! Sale created successfully');
          console.log('Response:', JSON.stringify(response.data, null, 2));
          break; // Found the working approach
        } else {
          console.log('❌ Failed:', response.data[0]?.original?.error?.message || 'Unknown error');
        }
      } catch (error) {
        console.log('❌ Failed:', error.response?.data?.[0]?.original?.error?.message || error.message);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testVariationApproaches();
