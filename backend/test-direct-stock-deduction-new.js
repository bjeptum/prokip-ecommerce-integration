const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testDirectStockDeduction() {
  try {
    console.log('🧪 Testing direct stock deduction bypassing all authentication...');
    
    // Get Prokip config directly
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });
    
    if (!prokipConfig?.token || !prokipConfig.locationId) {
      console.log('❌ Prokip config not found');
      return;
    }
    
    console.log('✅ Prokip config found');
    
    // Get WooCommerce order data directly
    const connection = await prisma.connection.findFirst({
      where: { platform: 'woocommerce' }
    });
    
    if (!connection) {
      console.log('❌ No WooCommerce connection found');
      return;
    }
    
    console.log('✅ WooCommerce connection found');
    
    // Fetch orders from WooCommerce
    const wooHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${connection.consumerKey}:${connection.consumerSecret}`).toString('base64')}`
    };
    
    const ordersResponse = await axios.get(`${connection.storeUrl}/wp-json/wc/v3/orders?per_page=3`, { headers: wooHeaders });
    const orders = ordersResponse.data;
    
    console.log(`📦 Found ${orders.length} orders`);
    
    // Process first order with stock deduction
    const order = orders[0];
    console.log(`🔄 Processing order #${order.id}...`);
    
    // Get Prokip products for variation mapping
    const prokipHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };
    
    const productsResponse = await axios.get('https://api.prokip.africa/connector/api/product?per_page=-1', { headers: prokipHeaders });
    const prokipProducts = productsResponse.data.data;
    
    console.log(`📦 Found ${prokipProducts.length} Prokip products`);
    
    // Process order items
    const finalTotal = parseFloat(order.total || order.total_price || 0);
    const sellProducts = order.line_items
      .filter(item => item.sku)
      .map(item => {
        const prokipProduct = prokipProducts.find(p => p.sku === item.sku);
        if (!prokipProduct) {
          console.log(`❌ Product with SKU ${item.sku} not found in Prokip`);
          return null;
        }
        
        // Handle variation_id correctly
        let variationId = prokipProduct.id;
        if (prokipProduct.variations && prokipProduct.variations.length > 0) {
          const firstVariation = prokipProduct.variations[0];
          if (firstVariation && firstVariation.variation_id) {
            variationId = firstVariation.variation_id;
          }
        } else if (prokipProduct.type === 'single' && item.sku === '4922111') {
          variationId = 5291257; // Known variation ID
        }
        
        return {
          name: item.name || 'Product',
          sku: item.sku,
          quantity: item.quantity,
          unit_price: parseFloat(item.price || 0),
          total_price: parseFloat(item.total || 0),
          product_id: prokipProduct.id,
          variation_id: variationId
        };
      });
    
    const validSellProducts = sellProducts.filter(p => p !== null);
    
    if (validSellProducts.length === 0) {
      console.log(`❌ No valid products found for order #${order.id}`);
      return;
    }
    
    // Create sale in Prokip using exact working format
    const sellBody = {
      sells: [{
        location_id: parseInt(prokipConfig.locationId),
        contact_id: 1849984, // Valid contact ID
        transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        invoice_no: `WC-${order.id}`,
        status: 'final',
        type: 'sell',
        payment_status: 'paid',
        final_total: finalTotal,
        products: validSellProducts,
        payments: [{
          method: 'woocommerce',
          amount: finalTotal,
          paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
        }]
      }]
    };
    
    console.log('📝 Creating sale with body:', JSON.stringify(sellBody, null, 2));
    
    // Make API call to Prokip
    const response = await axios.post('https://api.prokip.africa/connector/api/sell', sellBody, { headers: prokipHeaders });
    
    if (response.data && Array.isArray(response.data) && response.data.length > 0 && !response.data[0].original?.error) {
      console.log('✅ Sale created successfully!');
      console.log('📊 Response:', JSON.stringify(response.data, null, 2));
      
      // Create sales log entry
      await prisma.salesLog.create({
        data: {
          connectionId: connection.id,
          orderId: order.id.toString(),
          orderNumber: order.order_number?.toString() || order.id.toString(),
          customerName: order.customer?.first_name || order.billing?.first_name || 'Customer',
          customerEmail: order.customer?.email || order.billing?.email,
          totalAmount: finalTotal,
          status: 'completed',
          orderDate: new Date(order.created_at || order.date_created)
        }
      });
      
      console.log('✅ Sales log entry created');
      console.log('🎉 STOCK DEDUCTION SUCCESSFUL!');
    } else {
      console.log('❌ Sale creation failed:', response.data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testDirectStockDeduction();
