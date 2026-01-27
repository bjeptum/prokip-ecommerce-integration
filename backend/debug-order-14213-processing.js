const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { decryptCredentials } = require('./src/services/storeService');

const prisma = new PrismaClient();

async function debugOrder14213Processing() {
  try {
    console.log('🔍 Debugging order #14213 processing...');
    
    // Get WooCommerce connection
    const wooConnection = await prisma.connection.findFirst({ 
      where: { platform: 'woocommerce' } 
    });
    
    if (!wooConnection) {
      console.error('❌ WooCommerce connection not found');
      return;
    }
    
    // Get Prokip config
    const prokipConfig = await prisma.prokipConfig.findFirst();
    if (!prokipConfig) {
      console.error('❌ Prokip config not found');
      return;
    }
    
    // Get the order
    const { consumerKey, consumerSecret } = decryptCredentials(wooConnection);
    
    const wooHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`
    };
    
    const orderResponse = await axios.get(
      `${wooConnection.storeUrl}/wp-json/wc/v3/orders/14213`,
      { headers: wooHeaders }
    );
    
    const order = orderResponse.data;
    console.log(`📋 Order #${order.id}:`);
    console.log(`  - Status: ${order.status}`);
    console.log(`  - Items: ${order.line_items.length}`);
    
    // Get Prokip products
    const prokipHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };
    
    const productsResponse = await axios.get(
      'https://api.prokip.africa/connector/api/product?per_page=-1',
      { headers: prokipHeaders }
    );
    
    const prokipProducts = productsResponse.data.data;
    
    // Process the order items manually to see what happens
    for (const item of order.line_items) {
      if (!item.sku) {
        console.log(`  ⚠️ Item without SKU: ${item.name}`);
        continue;
      }
      
      console.log(`\n📋 Processing item: ${item.name} (SKU: ${item.sku}, Qty: ${item.quantity})`);
      
      // Find Prokip product
      const prokipProduct = prokipProducts.find(p => p.sku === item.sku);
      if (!prokipProduct) {
        console.log(`    ❌ Prokip product not found`);
        continue;
      }
      
      console.log(`    ✅ Found Prokip product: ${prokipProduct.name} (ID: ${prokipProduct.id})`);
      
      // Get Prokip stock
      try {
        const stockResponse = await axios.get(
          `https://api.prokip.africa/connector/api/product-stock-report?product_id=${prokipProduct.id}`,
          { headers: prokipHeaders }
        );
        
        const prokipStock = stockResponse.data?.[0]?.stock || stockResponse.data?.[0]?.qty_available || 0;
        console.log(`    📊 Prokip stock: ${prokipStock}`);
        
      } catch (stockError) {
        console.log(`    ❌ Error getting Prokip stock: ${stockError.message}`);
      }
      
      // Check local inventory
      const inventoryLog = await prisma.inventoryLog.findFirst({
        where: {
          connectionId: wooConnection.id,
          sku: item.sku
        }
      });
      
      const localStock = inventoryLog?.quantity || 0;
      console.log(`    📊 Local stock: ${localStock}`);
      
      const quantityToDeduct = Math.min(item.quantity, localStock);
      console.log(`    📊 Quantity to deduct: ${quantityToDeduct}`);
      
      if (quantityToDeduct > 0) {
        console.log(`    ✅ Should deduct ${quantityToDeduct} units`);
      } else {
        console.log(`    ⚠️ No stock to deduct`);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error.message);
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Data:`, error.response.data);
    }
  } finally {
    await prisma.$disconnect();
  }
}

debugOrder14213Processing();
