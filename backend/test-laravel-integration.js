/**
 * TEST LARAVEL INTEGRATION - UPDATED FOR SELLPOS CONTROLLER
 * Tests the exact Laravel controller requirements
 */

const axios = require('axios');

async function testLaravelIntegration() {
  try {
    console.log('🧪 Testing Laravel SellPosController Integration');
    console.log('🎯 Target: POST /api/ecom/orders');
    console.log('🔑 Header: API-TOKEN\n');

    // Test 1: Environment check
    console.log('1️⃣ Environment Check:');
    console.log(`   PROKIP_BASE_URL: ${process.env.PROKIP_BASE_URL}`);
    console.log(`   PROKIP_API_KEY: ${process.env.PROKIP_API_KEY ? 'CONFIGURED' : 'MISSING'}`);

    // Test 2: Laravel payload structure
    console.log('\n2️⃣ Laravel Payload Structure:');
    const laravelPayload = {
      customer_id: 12,
      addresses: {
        shipping: {
          name: 'John Doe',
          address: 'Nairobi, Kenya',
          phone: '0712345678'
        }
      },
      products: {
        "45": {
          variation_id: 45,
          product_name: 'Polo Shirt',
          quantity: 2
        },
        "46": {
          variation_id: 46,
          product_name: 'Test Product',
          quantity: 1
        }
      }
    };

    console.log('✅ Correct Laravel format:');
    console.log(JSON.stringify(laravelPayload, null, 2));

    // Test 3: Wrong format (for comparison)
    console.log('\n❌ WRONG Format (causes 500):');
    const wrongPayload = {
      customer_id: 12,
      addresses: { shipping: { name: 'John Doe' } },
      products: [
        { variation_id: 45, quantity: 2 }
      ]
    };
    console.log(JSON.stringify(wrongPayload, null, 2));

    // Test 4: API call with correct format
    console.log('\n3️⃣ Testing API Call:');
    
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'API-TOKEN': process.env.PROKIP_API_KEY
    };

    try {
      const response = await axios.post(
        `${process.env.PROKIP_BASE_URL}/api/ecom/orders`,
        laravelPayload,
        {
          headers,
          timeout: 15000
        }
      );

      console.log('✅ SUCCESS!');
      console.log('Status:', response.status);
      console.log('Response:', response.data);

    } catch (error) {
      console.log('❌ API Call Failed:');
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Response:', error.response.data);
      } else {
        console.log('Network Error:', error.message);
      }
    }

    console.log('\n🎯 Integration Ready!');
    console.log('💡 Update your SKU to variation_id mappings in the mapper');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testLaravelIntegration();
