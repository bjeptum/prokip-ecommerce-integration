const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testExactWorkingFormat() {
  try {
    console.log('🧪 Testing exact working format from prokipRoutes.js...');
    
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
    
    // Use the EXACT same structure as working prokipRoutes.js
    const products = [
      {
        sku: '4922111',
        quantity: 2,
        unitPrice: 525
      }
    ];
    
    // Get product info from Prokip first (exact same as working code)
    const productsResponse = await axios.get('https://api.prokip.africa/connector/api/product?per_page=-1', { headers });
    const prokipProducts = productsResponse.data.data;

    const sellProducts = [];
    let finalTotal = 0;

    for (const item of products) {
      const prokipProduct = prokipProducts.find(p => p.sku === item.sku);
      if (!prokipProduct) {
        console.log(`❌ Product with SKU ${item.sku} not found in Prokip`);
        continue;
      }

      const quantity = parseInt(item.quantity);
      const unitPrice = parseFloat(item.unitPrice);
      const subtotal = quantity * unitPrice;
      finalTotal += subtotal;

      sellProducts.push({
        product_id: prokipProduct.id,
        variation_id: prokipProduct.id, // Exact same as working code
        quantity,
        unit_price: unitPrice,
        unit_price_inc_tax: unitPrice
      });
    }

    // Create sale in Prokip (EXACT same as working code)
    const sellBody = {
      sells: [{
        location_id: parseInt(prokipConfig.locationId),
        contact_id: 1, // Same as working code
        transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        invoice_no: `TEST-${Date.now()}`,
        status: 'final',
        type: 'sell',
        payment_status: 'paid',
        final_total: finalTotal,
        products: sellProducts,
        payments: [{
          method: 'cash', // Same as working code
          amount: finalTotal,
          paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
        }]
      }]
    };

    console.log('📝 Exact working format sell body:', JSON.stringify(sellBody, null, 2));

    const saleResponse = await axios.post('https://api.prokip.africa/connector/api/sell', sellBody, { headers });
    console.log('✅ Exact format response:', JSON.stringify(saleResponse.data, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Error details:', error.response?.data || 'No details');
  } finally {
    await prisma.$disconnect();
  }
}

testExactWorkingFormat();
