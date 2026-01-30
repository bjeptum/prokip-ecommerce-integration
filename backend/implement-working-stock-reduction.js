const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');
const axios = require('axios');

const prisma = new PrismaClient();

async function implementWorkingStockReduction() {
  console.log('🔧 Implementing Working Stock Reduction Solution');
  console.log('============================================');

  try {
    // 1. First, let's reset our local inventory to match Prokip's current stock
    console.log('\n1️⃣ Resetting local inventory to match Prokip...');
    
    const prokipStock = await prokipService.getInventory(null, 50);
    const localInventory = await prisma.inventoryLog.findMany();
    
    for (const stockItem of prokipStock) {
      const localLog = localInventory.find(log => log.sku === stockItem.sku);
      
      if (localLog) {
        await prisma.inventoryLog.update({
          where: { id: localLog.id },
          data: { 
            quantity: parseInt(stockItem.stock),
            lastSynced: new Date()
          }
        });
        console.log(`   Reset SKU ${stockItem.sku}: ${localLog.quantity} → ${stockItem.stock}`);
      } else {
        await prisma.inventoryLog.create({
          data: {
            connectionId: 8, // Assuming connection ID 8
            sku: stockItem.sku,
            quantity: parseInt(stockItem.stock),
            productName: stockItem.name || `Product ${stockItem.sku}`,
            productId: stockItem.sku,
            price: parseFloat(stockItem.unit_price) || 0,
            lastSynced: new Date()
          }
        });
        console.log(`   Created SKU ${stockItem.sku}: ${stockItem.stock}`);
      }
    }

    // 2. Now let's test a sale with proper stock tracking
    console.log('\n2️⃣ Testing sale with stock reduction verification...');
    
    const testOrder = {
      id: Date.now(),
      number: Date.now().toString(),
      status: 'completed',
      date_created: new Date().toISOString(),
      total: '680.00',
      line_items: [{
        id: 1,
        name: 'Hair cream',
        sku: '4848961',
        quantity: 1,
        price: '680.00',
        total_tax: '0.00'
      }]
    };

    // Get current stock before sale
    const beforeStock = await prokipService.getInventory(null, 50);
    const beforeItem = beforeStock.find(item => item.sku === '4848961');
    const beforeQuantity = beforeItem ? parseInt(beforeItem.stock) : 0;
    
    console.log(`   Stock before sale: ${beforeQuantity}`);

    // Process the sale using our improved sync service
    const { processStoreToProkip } = require('./src/services/syncService');
    const connection = await prisma.connection.findFirst({ where: { platform: 'woocommerce' } });
    
    try {
      await processStoreToProkip(
        connection.storeUrl,
        'order.created',
        testOrder,
        'woocommerce',
        50
      );
      
      console.log('✅ Sale processed successfully');
      
      // Wait for stock to be processed
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check stock after sale
      const afterStock = await prokipService.getInventory(null, 50);
      const afterItem = afterStock.find(item => item.sku === '4848961');
      const afterQuantity = afterItem ? parseInt(afterItem.stock) : 0;
      
      console.log(`   Stock after sale: ${afterQuantity}`);
      console.log(`   Stock change: ${beforeQuantity} → ${afterQuantity} (${afterQuantity - beforeQuantity})`);
      
      if (afterQuantity < beforeQuantity) {
        console.log('🎉 SUCCESS! Stock was reduced in Prokip!');
      } else {
        console.log('❌ Stock was not reduced in Prokip');
        
        // Let's try a different approach - manual stock adjustment
        console.log('\n3️⃣ Attempting manual stock adjustment...');
        
        try {
          const adjustmentPayload = {
            location_id: 21237,
            adjustment_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
            reason: `WooCommerce sale ${testOrder.id}`,
            final_total: 0,
            products: [{
              product_id: 4848961,
              variation_id: 5216467,
              quantity: 1,
              unit_price: 0,
              adjustment_type: 'subtract'
            }]
          };

          const headers = await prokipService.getAuthHeaders(50);
          
          // Try different endpoints for stock adjustment
          const endpoints = [
            '/connector/api/stock-adjustments',
            '/connector/api/inventory-adjustments',
            '/connector/api/adjustments'
          ];
          
          for (const endpoint of endpoints) {
            try {
              const response = await axios.post(
                `https://api.prokip.africa${endpoint}`,
                adjustmentPayload,
                { headers, timeout: 10000 }
              );
              
              console.log(`✅ Stock adjustment successful via ${endpoint}`);
              console.log('   Response:', JSON.stringify(response.data, null, 2));
              break;
            } catch (error) {
              console.log(`❌ ${endpoint} failed:`, error.response?.data?.message || error.message);
            }
          }
          
        } catch (adjustmentError) {
          console.log('❌ Manual stock adjustment failed:', adjustmentError.message);
        }
      }
      
    } catch (processError) {
      console.error('❌ Sale processing failed:', processError.message);
    }

    // 4. Final verification
    console.log('\n4️⃣ Final verification...');
    
    const finalStock = await prokipService.getInventory(null, 50);
    const finalItem = finalStock.find(item => item.sku === '4848961');
    const finalQuantity = finalItem ? parseInt(finalItem.stock) : 0;
    
    console.log(`   Final stock: ${finalQuantity}`);
    console.log(`   Total change: ${beforeQuantity} → ${finalQuantity} (${finalQuantity - beforeQuantity})`);

    console.log('\n✅ Stock reduction implementation completed!');

  } catch (error) {
    console.error('❌ Implementation failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run implementation
implementWorkingStockReduction();
