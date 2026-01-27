const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testSellEndpoint() {
  try {
    console.log('🧪 Testing Prokip sell endpoint...');
    
    // Get Prokip config
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });
    
    if (!prokipConfig?.token) {
      console.log('❌ No Prokip config found');
      return;
    }
    
    console.log('✅ Prokip config found');
    console.log(`- Token: ${prokipConfig.token ? 'present' : 'missing'}`);
    console.log(`- Location ID: ${prokipConfig.locationId}`);
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };
    
    // Test the sell endpoint with a simple sale
    const testSale = {
      location_id: prokipConfig.locationId,
      customer_name: 'Test Customer',
      customer_email: 'test@example.com',
      total_amount: 100,
      payment_method: 'cash',
      reference_number: `TEST-${Date.now()}`,
      sale_date: new Date().toISOString(),
      line_items: [
        {
          sku: '4922111', // Use an existing SKU
          quantity: 1,
          unit_price: 100,
          total_price: 100
        }
      ]
    };
    
    console.log('\n📝 Test sale data:', JSON.stringify(testSale, null, 2));
    
    // Try different possible endpoints
    const endpoints = [
      'https://api.prokip.africa/connector/api/sell',
      'https://api.prokip.africa/connector/api/sales',
      'https://api.prokip.africa/connector/api/transaction'
    ];
    
    for (const endpoint of endpoints) {
      console.log(`\n🔍 Testing endpoint: ${endpoint}`);
      
      try {
        const response = await axios.post(endpoint, testSale, { headers });
        console.log('✅ SUCCESS! Response:', response.data);
        break;
      } catch (error) {
        console.log(`❌ Failed: ${error.response?.status} - ${error.response?.statusText}`);
        console.log(`Error details:`, error.response?.data || error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testSellEndpoint();
