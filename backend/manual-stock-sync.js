const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');
const wooService = require('./src/services/wooService');

const prisma = new PrismaClient();

/**
 * Process existing WooCommerce orders and deduct stock from Prokip
 * This script fixes the stock sync issue by processing completed orders
 */
async function processExistingOrders() {
  try {
    console.log('🔄 Processing existing WooCommerce orders for stock deduction...\n');

    // 1. Get WooCommerce connection
    const connection = await prisma.connection.findFirst({
      where: { platform: 'woocommerce' }
    });

    if (!connection) {
      throw new Error('No WooCommerce connection found');
    }

    console.log(`✅ Found WooCommerce connection: ${connection.storeUrl}`);

    // 2. Get recent completed orders from WooCommerce
    console.log('\n📦 Fetching recent completed orders from WooCommerce...');
    const orders = await wooService.getWooOrders(connection.storeUrl);
    
    const completedOrders = orders.filter(order => 
      ['completed', 'processing'].includes(order.status)
    );

    console.log(`✅ Found ${completedOrders.length} completed orders`);

    // 3. Get Prokip config
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: connection.userId }
    });

    if (!prokipConfig) {
      throw new Error('No Prokip config found');
    }

    console.log(`✅ Found Prokip config for location: ${prokipConfig.locationId}`);

    // 4. Process each order
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const order of completedOrders) {
      try {
        console.log(`\n🔍 Processing order ${order.id} (${order.number})...`);

        // Check if already processed
        const existingLog = await prisma.salesLog.findFirst({
          where: {
            connectionId: connection.id,
            orderId: order.id.toString()
          }
        });

        if (existingLog && existingLog.stockDeducted) {
          console.log(`⏭️ Order ${order.id} already processed, skipping`);
          skippedCount++;
          continue;
        }

        // Get products from order
        const productsForDeduction = [];
        
        for (const item of order.line_items || []) {
          if (item.sku) {
            // Find the product in Prokip to get product_id
            const prokipProduct = await prokipService.getProductBySku(item.sku, connection.userId);
            if (prokipProduct) {
              productsForDeduction.push({
                productId: prokipProduct.id,
                product_id: prokipProduct.id,
                quantity: item.quantity,
                sku: item.sku
              });
              console.log(`   📦 Found product ${item.sku} (ID: ${prokipProduct.id}), quantity: ${item.quantity}`);
            } else {
              console.warn(`   ⚠️ Product with SKU ${item.sku} not found in Prokip`);
            }
          }
        }

        if (productsForDeduction.length > 0) {
          console.log(`   🔄 Deducting stock for ${productsForDeduction.length} products...`);
          
          try {
            const deductionResponse = await prokipService.deductStockFromProkip(
              productsForDeduction,
              prokipConfig.locationId,
              `WooCommerce order ${order.id} (manual sync)`,
              connection.userId
            );
            
            console.log(`   ✅ Stock deducted successfully for order ${order.id}`);
            
            // Update or create sales log
            const salesLogData = {
              connectionId: connection.id,
              orderId: order.id.toString(),
              orderNumber: order.number?.toString(),
              invoiceNo: `WOO-${order.id}`,
              platform: 'woocommerce',
              customerName: order.billing?.first_name || 'Guest',
              customerEmail: order.billing?.email,
              totalAmount: parseFloat(order.total || 0),
              status: 'completed',
              orderDate: new Date(order.date_created),
              stockDeducted: true,
              stockDeductionDate: new Date()
            };

            if (existingLog) {
              await prisma.salesLog.update({
                where: { id: existingLog.id },
                data: salesLogData
              });
            } else {
              await prisma.salesLog.create({
                data: salesLogData
              });
            }
            
            processedCount++;
            
          } catch (deductionError) {
            console.error(`   ❌ Failed to deduct stock for order ${order.id}:`, deductionError.message);
            errorCount++;
          }
        } else {
          console.log(`   ℹ️ No products found for stock deduction in order ${order.id}`);
          skippedCount++;
        }

      } catch (orderError) {
        console.error(`❌ Error processing order ${order.id}:`, orderError.message);
        errorCount++;
      }
    }

    console.log('\n📊 Processing Summary:');
    console.log(`   ✅ Successfully processed: ${processedCount} orders`);
    console.log(`   ⏭️ Skipped: ${skippedCount} orders`);
    console.log(`   ❌ Errors: ${errorCount} orders`);

    // 5. Verify current stock levels
    console.log('\n🔍 Verifying current stock levels...');
    const prokipProducts = await prokipService.getProducts(prokipConfig.locationId, connection.userId);
    
    console.log('📦 Current Prokip stock levels:');
    prokipProducts.slice(0, 10).forEach(product => {
      console.log(`   ${product.sku || product.name}: ${product.stock || 0} units`);
    });

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  processExistingOrders();
}

module.exports = { processExistingOrders };
