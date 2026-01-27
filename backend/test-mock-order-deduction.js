const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testMockOrderDeduction() {
  try {
    console.log('🧪 Testing stock deduction with mock order...');
    
    // Get Prokip config directly
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });
    
    if (!prokipConfig?.token || !prokipConfig.locationId) {
      console.log('❌ Prokip config not found');
      return;
    }
    
    console.log('✅ Prokip config found');
    
    // Get WooCommerce connection for logging
    const connection = await prisma.connection.findFirst({
      where: { platform: 'woocommerce' }
    });
    
    if (!connection) {
      console.log('❌ No WooCommerce connection found');
      return;
    }
    
    console.log('✅ Using WooCommerce connection for logging');
    
    // Create a mock order that matches the real structure
    const mockOrder = {
      id: 14148,
      order_number: '14148',
      status: 'completed',
      total: '100.00',
      total_price: '100.00',
      created_at: '2026-01-22T12:00:00',
      date_created: '2026-01-22T12:00:00',
      customer: {
        first_name: 'Test',
        email: 'test@example.com'
      },
      billing: {
        first_name: 'Test',
        email: 'test@example.com'
      },
      line_items: [
        {
          id: 1,
          name: 'Marida Foundation',
          sku: '4922111',
          quantity: 1,
          price: '100.00',
          total: '100.00'
        }
      ]
    };
    
    console.log('📦 Created mock order:', mockOrder.id);
    
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
    const finalTotal = parseFloat(mockOrder.total || mockOrder.total_price || 0);
    const sellProducts = mockOrder.line_items
      .filter(item => item.sku)
      .map(item => {
        const prokipProduct = prokipProducts.find(p => p.sku === item.sku);
        if (!prokipProduct) {
          console.log(`❌ Product with SKU ${item.sku} not found in Prokip`);
          return null;
        }
        
        console.log(`📦 Found product: ${prokipProduct.name} (ID: ${prokipProduct.id}, Type: ${prokipProduct.type})`);
        
        // Handle variation_id correctly
        let variationId = prokipProduct.id;
        if (prokipProduct.variations && prokipProduct.variations.length > 0) {
          const firstVariation = prokipProduct.variations[0];
          if (firstVariation && firstVariation.variation_id) {
            variationId = firstVariation.variation_id;
            console.log(`🔄 Using variation ID: ${variationId} for product ${item.sku}`);
          }
        } else if (prokipProduct.type === 'single' && item.sku === '4922111') {
          variationId = 5291257; // Known variation ID
          console.log(`🔄 Using known variation ID: ${variationId} for single product ${item.sku}`);
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
      console.log(`❌ No valid products found for order #${mockOrder.id}`);
      return;
    }
    
    // Create sale in Prokip using exact working format
    const sellBody = {
      sells: [{
        location_id: parseInt(prokipConfig.locationId),
        contact_id: 1849984, // Valid contact ID
        transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        invoice_no: `WC-${mockOrder.id}`,
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
          orderId: mockOrder.id.toString(),
          orderNumber: mockOrder.order_number?.toString() || mockOrder.id.toString(),
          customerName: mockOrder.customer?.first_name || mockOrder.billing?.first_name || 'Customer',
          customerEmail: mockOrder.customer?.email || mockOrder.billing?.email,
          totalAmount: finalTotal,
          status: 'completed',
          orderDate: new Date(mockOrder.created_at || mockOrder.date_created)
        }
      });
      
      console.log('✅ Sales log entry created');
      console.log('🎉 STOCK DEDUCTION SUCCESSFUL!');
      console.log('🔍 Check Prokip inventory to verify stock was deducted');
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

testMockOrderDeduction();
