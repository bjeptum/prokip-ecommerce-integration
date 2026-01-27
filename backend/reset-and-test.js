const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function resetAndTest() {
  try {
    console.log('🔄 Resetting and testing stock deduction...');
    
    // Delete existing sales log entry for order #14148
    const deletedEntry = await prisma.salesLog.deleteMany({
      where: {
        connectionId: 5,
        orderId: '14148'
      }
    });
    
    console.log(`✅ Deleted ${deletedEntry.count} existing sales log entries`);
    
    // Now test the corrected format
    console.log('\n🧪 Testing corrected sale format...');
    
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
    
    // Get WooCommerce order data
    console.log('📦 Getting WooCommerce order #14148...');
    const { getWooOrders } = require('./src/services/wooService');
    const { decryptCredentials } = require('./src/services/storeService');
    
    const connection = await prisma.connection.findFirst({
      where: { id: 5 }
    });
    
    const { consumerKey, consumerSecret } = decryptCredentials(connection);
    const orders = await getWooOrders(connection.storeUrl, consumerKey, consumerSecret, null, null, null, null, null);
    
    const order = orders.find(o => o.id.toString() === '14148');
    if (!order) {
      console.log('❌ Order #14148 not found in WooCommerce');
      return;
    }
    
    console.log(`✅ Found order #${order.id} with ${order.line_items.length} items`);
    
    // Get product info from Prokip first to get product_id
    console.log('🔍 Getting product info from Prokip...');
    const productsResponse = await axios.get('https://api.prokip.africa/connector/api/product?per_page=-1', { headers });
    const prokipProducts = productsResponse.data.data;
    
    const sellProducts = [];
    let finalTotal = 0;
    
    for (const item of order.line_items) {
      if (!item.sku) continue;
      
      const prokipProduct = prokipProducts.find(p => p.sku === item.sku);
      if (!prokipProduct) {
        console.log(`❌ Product with SKU ${item.sku} not found in Prokip`);
        continue;
      }
      
      console.log(`📦 Product ${item.sku}:`, {
        id: prokipProduct.id,
        name: prokipProduct.name,
        type: prokipProduct.type,
        variations: prokipProduct.variations ? 'has variations' : 'no variations'
      });
      
      const quantity = parseInt(item.quantity);
      const unitPrice = parseFloat(item.price || 0);
      const subtotal = quantity * unitPrice;
      finalTotal += subtotal;
      
      // Handle variation_id properly
      let variationId = prokipProduct.id;
      if (prokipProduct.type === 'variable' && prokipProduct.variations && prokipProduct.variations.length > 0) {
        // Use the first variation for variable products
        variationId = prokipProduct.variations[0].variation_id;
        console.log(`🔄 Using variation ID: ${variationId} for variable product`);
      }
      
      sellProducts.push({
        product_id: prokipProduct.id,
        variation_id: prokipProduct.id, // Same as working code
        quantity,
        unit_price: unitPrice,
        unit_price_inc_tax: unitPrice,
        sell_line_note: `WooCommerce order #${order.id}`, // Add missing field
        tax_id: null, // Add missing field
        line_discount_type: 'fixed',
        line_discount_amount: 0
      });
    }
    
    if (sellProducts.length === 0) {
      console.log('❌ No valid products found for sale');
      return;
    }
    
    // Use existing contact ID from previous sales
    const validContactId = 1849984; // From existing sales data
    console.log(`✅ Using existing contact ID: ${validContactId}`);
    
    // Use the CORRECT format from prokipRoutes.js
    const correctSellBody = {
      sells: [{
        location_id: parseInt(prokipConfig.locationId),
        contact_id: validContactId, // Use real contact ID
        transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        invoice_no: `WC-${order.id}`,
        status: 'final',
        type: 'sell',
        payment_status: 'paid',
        final_total: finalTotal,
        products: sellProducts,
        payments: [{
          method: 'woocommerce',
          amount: finalTotal,
          paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
        }]
      }]
    };
    
    console.log('📝 Corrected sell body:', JSON.stringify(correctSellBody, null, 2));
    
    const response = await axios.post('https://api.prokip.africa/connector/api/sell', correctSellBody, { headers });
    console.log('✅ Corrected format response:', JSON.stringify(response.data, null, 2));
    
    // Check if sale was actually created
    if (response.data && response.data[0] && !response.data[0].original?.error) {
      console.log('✅ Sale created successfully with corrected format!');
      
      // Create sales log entry
      await prisma.salesLog.create({
        data: {
          connectionId: 5,
          orderId: '14148',
          orderNumber: '14148',
          customerName: 'Dorcas',
          customerEmail: 'litalakendi975@gmail.com',
          totalAmount: finalTotal,
          status: 'completed',
          orderDate: new Date()
        }
      });
      
      console.log('✅ Sales log entry created');
      
      // Wait and check if sale appears in Prokip
      console.log('\n⏳ Waiting 3 seconds to check if sale appears...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const salesResponse = await axios.get('https://api.prokip.africa/connector/api/sell?per_page=100', { headers });
      const salesData = salesResponse.data.data || [];
      
      const ourSale = salesData.find(sale => sale.reference_number === correctSellBody.transactions[0].payments[0].paid_on.slice(0, 10));
      if (ourSale) {
        console.log('✅ Sale found in Prokip sales list!');
        console.log(`- ID: ${ourSale.id}`);
        console.log(`- Amount: ${ourSale.final_total}`);
        console.log(`- Status: ${ourSale.status}`);
      } else {
        console.log('❌ Sale still not found in Prokip sales list');
      }
      
    } else {
      console.log('❌ Corrected format still failed:', response.data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetAndTest();
