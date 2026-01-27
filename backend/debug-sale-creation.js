const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function debugSaleCreation() {
  try {
    console.log('🔍 Debugging sale creation process...');
    
    // Get Prokip config
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });
    
    if (!prokipConfig?.token) {
      console.log('❌ No Prokip config found');
      return;
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };
    
    // Test with minimal required data first
    console.log('\n🧪 Test 1: Minimal sale data');
    const minimalSale = {
      location_id: prokipConfig.locationId,
      customer_name: 'Debug Test',
      total_amount: 100,
      payment_method: 'cash',
      reference_number: `DEBUG-${Date.now()}`,
      sale_date: new Date().toISOString(),
      line_items: [
        {
          sku: '4922111',
          quantity: 1,
          unit_price: 100,
          total_price: 100
        }
      ]
    };
    
    try {
      const response = await axios.post('https://api.prokip.africa/connector/api/sell', minimalSale, { headers });
      console.log('✅ Minimal sale response:', JSON.stringify(response.data, null, 2));
      
      // Check if the sale was actually created by looking for it
      console.log('\n🔍 Checking if sale was created...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const salesResponse = await axios.get('https://api.prokip.africa/connector/api/sell?per_page=100', { headers });
      const salesData = salesResponse.data.data || [];
      
      const ourSale = salesData.find(sale => sale.reference_number === minimalSale.reference_number);
      if (ourSale) {
        console.log('✅ Sale was created successfully!');
        console.log(`- ID: ${ourSale.id}`);
        console.log(`- Status: ${ourSale.status}`);
        console.log(`- Amount: ${ourSale.final_total}`);
      } else {
        console.log('❌ Sale was NOT created in Prokip!');
        console.log('The API response was misleading - sale creation failed silently');
      }
      
    } catch (error) {
      console.log('❌ Minimal sale failed:', error.response?.data || error.message);
    }
    
    // Test with the exact format from working prokipRoutes.js
    console.log('\n🧪 Test 2: Using prokipRoutes.js format');
    
    const finalTotal = 1889.99;
    const sellProducts = [
      {
        name: 'Test Product',
        sku: '4922111',
        quantity: 2,
        unit_price: 525,
        total_price: 1050
      }
    ];
    
    const prokipRoutesFormat = {
      location_id: prokipConfig.locationId,
      contact_id: 1849984, // From the existing sales data
      transactions: [{
        type: 'sell',
        payment_status: 'paid',
        final_total: finalTotal,
        products: sellProducts,
        payments: [{
          method: 'cash',
          amount: finalTotal,
          paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
        }]
      }]
    };
    
    try {
      const response2 = await axios.post('https://api.prokip.africa/connector/api/sell', prokipRoutesFormat, { headers });
      console.log('✅ ProkipRoutes format response:', JSON.stringify(response2.data, null, 2));
      
    } catch (error) {
      console.log('❌ ProkipRoutes format failed:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugSaleCreation();
