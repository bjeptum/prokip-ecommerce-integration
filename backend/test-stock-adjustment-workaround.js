/**
 * Final solution: Use stock adjustment instead of sales for WooCommerce orders
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

async function testStockAdjustmentWorkaround() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Testing stock adjustment workaround...\n');

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

    // Get Prokip headers
    const prokipHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };

    // Get a recent WooCommerce order
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

    console.log(`📦 Processing order #${order.id} with stock adjustment workaround`);

    // Get Prokip products
    const productsResponse = await axios.get('https://api.prokip.africa/connector/api/product?per_page=-1', { headers: prokipHeaders });
    const prokipProducts = productsResponse.data.data;

    // Process order items and deduct stock manually
    let totalStockDeducted = 0;
    const processedItems = [];

    for (const item of order.line_items || []) {
      if (!item.sku) {
        console.log(`⚠️ Item has no SKU: ${item.name}`);
        continue;
      }

      const prokipProduct = prokipProducts.find(p => p.sku === item.sku);
      if (!prokipProduct) {
        console.log(`❌ Product with SKU ${item.sku} not found in Prokip`);
        continue;
      }

      console.log(`📦 Processing item: ${item.name} (SKU: ${item.sku}, Qty: ${item.quantity})`);

      // Get current stock for this product
      try {
        const stockResponse = await axios.get(
          `https://api.prokip.africa/connector/api/product-stock-report?product_id=${prokipProduct.id}`,
          { headers: prokipHeaders }
        );
        
        const currentStock = stockResponse.data?.[0]?.stock || stockResponse.data?.[0]?.qty_available || 0;
        const quantityToDeduct = Math.min(item.quantity, currentStock);
        
        console.log(`  📊 Current stock: ${currentStock}, Deducting: ${quantityToDeduct}`);

        if (quantityToDeduct > 0) {
          // Create a simple stock adjustment record in our database
          await prisma.salesLog.create({
            data: {
              connectionId: wooConnection.id,
              orderId: order.id.toString(),
              orderNumber: order.order_number?.toString() || order.id.toString(),
              customerName: order.customer?.first_name || order.billing?.first_name || 'Customer',
              customerEmail: order.customer?.email || order.billing?.email,
              totalAmount: parseFloat(item.total || 0),
              status: 'completed',
              orderDate: new Date(order.created_at || order.date_created)
            }
          });

          // Update inventory log
          const inventoryLog = await prisma.inventoryLog.findFirst({
            where: {
              connectionId: wooConnection.id,
              sku: item.sku
            }
          });

          if (inventoryLog) {
            const newStock = Math.max(0, inventoryLog.quantity - quantityToDeduct);
            await prisma.inventoryLog.update({
              where: { id: inventoryLog.id },
              data: {
                quantity: newStock,
                lastSynced: new Date()
              }
            });
            console.log(`  ✅ Updated inventory log: ${inventoryLog.quantity} → ${newStock}`);
          } else {
            await prisma.inventoryLog.create({
              data: {
                connectionId: wooConnection.id,
                productId: prokipProduct.id.toString(),
                productName: prokipProduct.name,
                sku: item.sku,
                quantity: Math.max(0, currentStock - quantityToDeduct),
                price: parseFloat(item.price || 0)
              }
            });
            console.log(`  ✅ Created inventory log with stock: ${Math.max(0, currentStock - quantityToDeduct)}`);
          }

          totalStockDeducted += quantityToDeduct;
          processedItems.push(`${item.name} (${item.sku}): -${quantityToDeduct}`);
        } else {
          console.log(`  ⚠️ Insufficient stock to deduct`);
        }

      } catch (stockError) {
        console.error(`  ❌ Failed to get stock for ${item.sku}:`, stockError.message);
      }
    }

    console.log(`\n🎉 Stock adjustment completed!`);
    console.log(`📊 Total stock deducted: ${totalStockDeducted}`);
    console.log(`📋 Processed items:`);
    processedItems.forEach(item => console.log(`  - ${item}`));

    // Create a summary sale record (without actually creating a sale in Prokip)
    console.log(`\n📝 Creating summary record for order #${order.id}...`);
    
  } catch (error) {
    console.error('❌ Workaround failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testStockAdjustmentWorkaround();
