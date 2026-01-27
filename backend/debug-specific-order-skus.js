/**
 * Debug specific WooCommerce order SKUs and their Prokip mapping
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

async function debugSpecificOrderSKUs() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Debugging specific WooCommerce order SKUs...\n');

    // Get WooCommerce connection
    const wooConnection = await prisma.connection.findFirst({ 
      where: { platform: 'woocommerce' } 
    });

    if (!wooConnection) {
      console.error('❌ No WooCommerce connection found');
      return;
    }

    // Decrypt credentials
    const { decryptCredentials } = require('./src/services/storeService');
    const { consumerKey, consumerSecret } = decryptCredentials(wooConnection);
    
    const wooHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`
    };

    // Get recent processing orders
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const ordersResponse = await axios.get(
      `${wooConnection.storeUrl}/wp-json/wc/v3/orders?after=${sevenDaysAgo}&per_page=3&status=processing`,
      { headers: wooHeaders }
    );
    
    const orders = ordersResponse.data;
    console.log(`📊 Found ${orders.length} recent processing orders`);

    // Get Prokip products
    const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId: 50 } });
    const prokipHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };
    
    const productsResponse = await axios.get('https://api.prokip.africa/connector/api/product?per_page=-1', { headers: prokipHeaders });
    const prokipProducts = productsResponse.data.data;
    console.log(`📦 Found ${prokipProducts.length} Prokip products`);

    // Debug each order
    for (const order of orders) {
      console.log(`\n🔍 Order #${order.id} (${order.order_number}):`);
      console.log(`  Status: ${order.status}`);
      console.log(`  Total: ${order.total}`);
      console.log(`  Items: ${order.line_items?.length || 0}`);
      
      for (const item of order.line_items || []) {
        if (item.sku) {
          console.log(`\n  📦 Item: ${item.name}`);
          console.log(`    SKU: ${item.sku}`);
          console.log(`    Quantity: ${item.quantity}`);
          console.log(`    Price: ${item.price}`);
          
          // Find in Prokip
          const prokipProduct = prokipProducts.find(p => p.sku === item.sku);
          if (prokipProduct) {
            console.log(`    ✅ Found in Prokip: ${prokipProduct.name}`);
            console.log(`    📋 Product ID: ${prokipProduct.id}`);
            console.log(`    📋 Product Type: ${prokipProduct.type}`);
            
            // Debug variation structure
            console.log(`    🔍 Product structure keys: ${Object.keys(prokipProduct)}`);
            
            if (prokipProduct.product_variations) {
              console.log(`    📋 Product variations: ${prokipProduct.product_variations.length}`);
              prokipProduct.product_variations.forEach((pv, index) => {
                console.log(`      Variation ${index}: ${pv.name} (ID: ${pv.id})`);
                if (pv.variations) {
                  console.log(`        Sub-variations: ${pv.variations.length}`);
                  pv.variations.forEach((v, vIndex) => {
                    console.log(`          Sub ${vIndex}: ${v.name} (variation_id: ${v.variation_id})`);
                  });
                }
              });
            } else {
              console.log(`    ❌ No product_variations found`);
            }
            
            // Try to extract variation_id using the same logic as the sync
            let variationId = prokipProduct.id;
            
            if (prokipProduct.product_variations && prokipProduct.product_variations.length > 0) {
              for (const productVariation of prokipProduct.product_variations) {
                if (productVariation.variations && productVariation.variations.length > 0) {
                  const firstVariation = productVariation.variations[0];
                  if (firstVariation && firstVariation.variation_id) {
                    variationId = firstVariation.variation_id;
                    console.log(`    ✅ Extracted variation_id: ${variationId}`);
                    break;
                  }
                }
              }
            }
            
            console.log(`    🎯 Final variation_id: ${variationId}`);
            
          } else {
            console.log(`    ❌ NOT FOUND in Prokip`);
          }
        } else {
          console.log(`    ⚠️ Item has no SKU`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugSpecificOrderSKUs();
