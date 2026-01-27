const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { decryptCredentials } = require('./src/services/storeService');

const prisma = new PrismaClient();

async function debugOrder14158() {
  try {
    console.log('🔍 Debugging Order 14158...');
    
    // Get WooCommerce connection
    const wooConnection = await prisma.connection.findFirst({ 
      where: { platform: 'woocommerce' } 
    });
    
    if (!wooConnection) {
      console.error('❌ WooCommerce connection not found');
      return;
    }
    
    console.log(`✅ Found WooCommerce connection: ${wooConnection.storeUrl}`);
    
    // Decrypt credentials
    const { consumerKey, consumerSecret } = decryptCredentials(wooConnection);
    
    const wooHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`
    };
    
    // Get order details from WooCommerce
    console.log('📦 Fetching order 14158 from WooCommerce...');
    const orderResponse = await axios.get(
      `${wooConnection.storeUrl}/wp-json/wc/v3/orders/14158`,
      { headers: wooHeaders }
    );
    
    const order = orderResponse.data;
    console.log('📋 Order details:');
    console.log(`  - ID: ${order.id}`);
    console.log(`  - Status: ${order.status}`);
    console.log(`  - Date: ${order.date_created}`);
    console.log(`  - Total: ${order.total}`);
    console.log(`  - Items: ${order.line_items.length}`);
    
    // Check if already processed
    const existingLog = await prisma.salesLog.findFirst({
      where: {
        connectionId: wooConnection.id,
        orderId: order.id.toString()
      }
    });
    
    if (existingLog) {
      console.log(`⚠️ Order ${order.id} already processed on ${existingLog.orderDate}`);
      console.log(`  - Sales log ID: ${existingLog.id}`);
      console.log(`  - Status: ${existingLog.status}`);
    } else {
      console.log(`✅ Order ${order.id} NOT processed yet`);
    }
    
    // Check inventory for each item
    console.log('📦 Checking inventory for order items...');
    for (const item of order.line_items) {
      if (!item.sku) {
        console.log(`  ⚠️ Item without SKU: ${item.name}`);
        continue;
      }
      
      console.log(`  📋 Item: ${item.name} (SKU: ${item.sku}, Qty: ${item.quantity})`);
      
      // Check inventory log
      const inventoryLog = await prisma.inventoryLog.findFirst({
        where: {
          connectionId: wooConnection.id,
          sku: item.sku
        }
      });
      
      if (inventoryLog) {
        console.log(`    📊 Current inventory: ${inventoryLog.quantity} units`);
        console.log(`    📅 Last synced: ${inventoryLog.lastSynced?.toISOString()}`);
      } else {
        console.log(`    ❌ No inventory log found for SKU ${item.sku}`);
      }
    }
    
    // Get Prokip config
    const prokipConfig = await prisma.prokipConfig.findFirst();
    if (prokipConfig) {
      console.log('🔑 Prokip config found');
      
      // Try to get Prokip product for first item with SKU
      const firstItemWithSku = order.line_items.find(item => item.sku);
      if (firstItemWithSku) {
        try {
          const prokipHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${prokipConfig.token}`,
            Accept: 'application/json'
          };
          
          const productsResponse = await axios.get(
            `https://api.prokip.africa/connector/api/product?per_page=-1`,
            { headers: prokipHeaders }
          );
          
          const prokipProduct = productsResponse.data.data.find(p => p.sku === firstItemWithSku.sku);
          if (prokipProduct) {
            console.log(`  ✅ Found Prokip product: ${prokipProduct.name} (ID: ${prokipProduct.id})`);
            
            // Get current stock from Prokip
            try {
              const stockResponse = await axios.get(
                `https://api.prokip.africa/connector/api/product-stock-report?product_id=${prokipProduct.id}`,
                { headers: prokipHeaders }
              );
              
              const currentStock = stockResponse.data?.[0]?.stock || stockResponse.data?.[0]?.qty_available || 0;
              console.log(`  📊 Prokip stock: ${currentStock} units`);
            } catch (stockError) {
              console.log(`  ❌ Could not fetch Prokip stock: ${stockError.message}`);
            }
          } else {
            console.log(`  ❌ Prokip product not found for SKU ${firstItemWithSku.sku}`);
          }
        } catch (error) {
          console.log(`  ❌ Error checking Prokip: ${error.message}`);
        }
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

debugOrder14158();
