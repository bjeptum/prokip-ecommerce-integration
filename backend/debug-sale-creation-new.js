/**
 * Debug the actual sale data being sent to Prokip API
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

async function debugSaleCreation() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Debugging sale creation data structure...\n');

    // Get configurations
    const [wooConnection, prokipConfig] = await Promise.all([
      prisma.connection.findFirst({ where: { platform: 'woocommerce' } }),
      prisma.prokipConfig.findFirst({ where: { userId: 50 } })
    ]);

    if (!wooConnection || !prokipConfig) {
      console.error('❌ Missing configurations');
      return;
    }

    // Decrypt credentials
    const { decryptCredentials } = require('./src/services/storeService');
    const { consumerKey, consumerSecret } = decryptCredentials(wooConnection);

    // Get a recent order
    const wooHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`
    };

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const ordersResponse = await axios.get(
      `${wooConnection.storeUrl}/wp-json/wc/v3/orders?after=${sevenDaysAgo}&per_page=1&status=processing`,
      { headers: wooHeaders }
    );
    
    const order = ordersResponse.data[0];
    if (!order) {
      console.log('❌ No recent orders found');
      return;
    }

    console.log(`📦 Debugging order #${order.id}`);

    // Get Prokip products
    const prokipHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };
    
    const productsResponse = await axios.get('https://api.prokip.africa/connector/api/product?per_page=-1', { headers: prokipHeaders });
    const prokipProducts = productsResponse.data.data;

    // Build the sale data exactly like the sync does
    const finalTotal = parseFloat(order.total || order.total_price || 0);
    const sellProducts = order.line_items
      .filter(item => item.sku)
      .map(item => {
        const prokipProduct = prokipProducts.find(p => p.sku === item.sku);
        if (!prokipProduct) {
          console.log(`❌ Product with SKU ${item.sku} not found in Prokip`);
          return null;
        }
        
        // Use the same variation_id logic as the sync
        let variationId = prokipProduct.id;
        
        if (prokipProduct.type === 'single') {
          variationId = prokipProduct.id;
          console.log(`🔍 Single product: using product_id ${variationId} as variation_id for SKU ${item.sku}`);
        }
        
        console.log(`📦 Final variation_id for SKU ${item.sku}: ${variationId}`);
        
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
      console.log('❌ No valid products found');
      return;
    }

    // Create the exact sale body
    const sellBody = {
      sells: [{
        location_id: parseInt(prokipConfig.locationId),
        contact_id: 1849984,
        transaction_date: new Date(order.created_at || order.date_created).toISOString().slice(0, 19).replace('T', ' '),
        invoice_no: `WC-${order.id}`,
        status: 'final',
        type: 'sell',
        payment_status: 'paid',
        final_total: finalTotal,
        products: validSellProducts,
        payments: [{
          method: 'woocommerce',
          amount: finalTotal,
          paid_on: new Date(order.created_at || order.date_created).toISOString().slice(0, 19).replace('T', ' ')
        }]
      }]
    };

    console.log('\n📝 Sale body being sent to Prokip:');
    console.log(JSON.stringify(sellBody, null, 2));

    // Try to create the sale
    console.log('\n🔄 Attempting to create sale...');
    try {
      const response = await axios.post('https://api.prokip.africa/connector/api/sell', sellBody, { headers: prokipHeaders });
      console.log('✅ Sale created successfully!');
      console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error('❌ Sale creation failed:');
      console.error('Status:', error.response?.status);
      console.error('Error:', error.response?.data);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugSaleCreation();
