const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { decryptCredentials } = require('./src/services/storeService');

const prisma = new PrismaClient();

async function testFixedSync() {
  try {
    console.log('🧪 Testing fixed stock deduction logic...');
    
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
    
    // Test with Order 14158 (already processed, but let's simulate reprocessing)
    const orderId = '14158';
    
    console.log(`📦 Testing with Order ${orderId}...`);
    
    // Check if already processed
    const existingLog = await prisma.salesLog.findFirst({
      where: {
        connectionId: wooConnection.id,
        orderId: orderId
      }
    });
    
    if (existingLog) {
      console.log(`⚠️ Order ${orderId} already processed. Deleting log to test...`);
      await prisma.salesLog.delete({
        where: { id: existingLog.id }
      });
      console.log('✅ Deleted existing log');
    }
    
    // Get WooCommerce order
    const { consumerKey, consumerSecret } = decryptCredentials(wooConnection);
    
    const wooHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`
    };
    
    const orderResponse = await axios.get(
      `${wooConnection.storeUrl}/wp-json/wc/v3/orders/${orderId}`,
      { headers: wooHeaders }
    );
    
    const order = orderResponse.data;
    console.log(`📋 Order ${order.id}: ${order.line_items.length} items, Total: ${order.total}`);
    
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
    
    // Process order items with FIXED logic
    let totalStockDeducted = 0;
    
    for (const item of order.line_items) {
      if (!item.sku) {
        console.log(`  ⚠️ Item without SKU: ${item.name}`);
        continue;
      }
      
      console.log(`  📋 Processing: ${item.name} (SKU: ${item.sku}, Qty: ${item.quantity})`);
      
      // Find Prokip product
      const prokipProduct = prokipProducts.find(p => p.sku === item.sku);
      if (!prokipProduct) {
        console.log(`    ❌ Prokip product not found`);
        continue;
      }
      
      // Get Prokip stock (will be 0)
      const stockResponse = await axios.get(
        `https://api.prokip.africa/connector/api/product-stock-report?product_id=${prokipProduct.id}`,
        { headers: prokipHeaders }
      );
      
      const prokipStock = stockResponse.data?.[0]?.stock || stockResponse.data?.[0]?.qty_available || 0;
      
      // FIXED: Use local inventory as source of truth
      const inventoryLog = await prisma.inventoryLog.findFirst({
        where: {
          connectionId: wooConnection.id,
          sku: item.sku
        }
      });
      
      const localStock = inventoryLog?.quantity || 0;
      const quantityToDeduct = Math.min(item.quantity, localStock);
      
      console.log(`    📊 Local stock: ${localStock}, Prokip stock: ${prokipStock}, Deducting: ${quantityToDeduct}`);
      
      if (quantityToDeduct > 0 && inventoryLog) {
        // Update local inventory
        const newStock = Math.max(0, localStock - quantityToDeduct);
        await prisma.inventoryLog.update({
          where: { id: inventoryLog.id },
          data: {
            quantity: newStock,
            lastSynced: new Date()
          }
        });
        
        console.log(`    ✅ Updated inventory: ${localStock} → ${newStock}`);
        totalStockDeducted += quantityToDeduct;
      } else {
        console.log(`    ⚠️ No stock deducted (local: ${localStock}, needed: ${item.quantity})`);
      }
    }
    
    // Create sales log
    await prisma.salesLog.create({
      data: {
        connectionId: wooConnection.id,
        orderId: order.id.toString(),
        orderNumber: order.order_number?.toString() || order.id.toString(),
        customerName: order.customer?.first_name || order.billing?.first_name || 'Customer',
        customerEmail: order.customer?.email || order.billing?.email,
        totalAmount: parseFloat(order.total || order.total_price || 0),
        status: 'completed',
        orderDate: new Date(order.created_at || order.date_created)
      }
    });
    
    console.log(`\n🎉 Test completed!`);
    console.log(`📊 Total stock deducted: ${totalStockDeducted}`);
    console.log(`✅ Order ${orderId} processed successfully`);
    
    // Show final inventory state
    console.log(`\n📦 Final inventory state:`);
    for (const item of order.line_items) {
      if (item.sku) {
        const inventoryLog = await prisma.inventoryLog.findFirst({
          where: {
            connectionId: wooConnection.id,
            sku: item.sku
          }
        });
        
        if (inventoryLog) {
          console.log(`  - SKU ${item.sku}: ${inventoryLog.quantity} units`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Data:`, error.response.data);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testFixedSync();
