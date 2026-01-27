const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function fixStockSync() {
  try {
    console.log('🔧 Fixing stock synchronization...');
    
    // Get Prokip config
    const prokipConfig = await prisma.prokipConfig.findFirst();
    if (!prokipConfig) {
      console.error('❌ Prokip config not found');
      return;
    }
    
    const prokipHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };
    
    // Get WooCommerce connection
    const wooConnection = await prisma.connection.findFirst({ 
      where: { platform: 'woocommerce' } 
    });
    
    if (!wooConnection) {
      console.error('❌ WooCommerce connection not found');
      return;
    }
    
    // Get all inventory logs
    console.log('📦 Getting local inventory logs...');
    const inventoryLogs = await prisma.inventoryLog.findMany({
      where: {
        connectionId: wooConnection.id
      }
    });
    
    console.log(`📊 Found ${inventoryLogs.length} inventory logs`);
    
    // Get Prokip products
    console.log('📦 Getting Prokip products...');
    const productsResponse = await axios.get(
      'https://api.prokip.africa/connector/api/product?per_page=-1',
      { headers: prokipHeaders }
    );
    
    const prokipProducts = productsResponse.data.data;
    console.log(`📊 Found ${prokipProducts.length} Prokip products`);
    
    // Check each inventory log against Prokip stock
    for (const log of inventoryLogs) {
      console.log(`\n🔍 Checking SKU: ${log.sku}`);
      console.log(`  📊 Local stock: ${log.quantity}`);
      
      // Find corresponding Prokip product
      const prokipProduct = prokipProducts.find(p => p.sku === log.sku);
      if (!prokipProduct) {
        console.log(`  ❌ Prokip product not found for SKU: ${log.sku}`);
        continue;
      }
      
      // Get current Prokip stock
      try {
        const stockResponse = await axios.get(
          `https://api.prokip.africa/connector/api/product-stock-report?product_id=${prokipProduct.id}`,
          { headers: prokipHeaders }
        );
        
        const prokipStock = stockResponse.data?.[0]?.stock || stockResponse.data?.[0]?.qty_available || 0;
        console.log(`  📊 Prokip stock: ${prokipStock}`);
        
        const difference = log.quantity - prokipStock;
        if (Math.abs(difference) > 0) {
          console.log(`  ⚠️ Stock difference: ${difference > 0 ? '+' : ''}${difference}`);
          
          if (difference > 0) {
            console.log(`  💡 Need to add ${difference} units to Prokip`);
            
            // Try to find a stock adjustment method
            // Method: Create a purchase transaction to add stock
            try {
              const purchaseData = {
                location_id: prokipConfig.locationId,
                supplier: {
                  name: 'Stock Adjustment'
                },
                products: [{
                  product_id: prokipProduct.id,
                  sku: log.sku,
                  quantity: difference,
                  unit_price: 1,
                  total_price: difference
                }],
                final_total: difference,
                transaction_date: new Date().toISOString()
              };
              
              console.log('  📝 Creating purchase transaction to add stock...');
              const purchaseResponse = await axios.post(
                'https://api.prokip.africa/connector/api/purchase',
                purchaseData,
                { headers: prokipHeaders }
              );
              
              console.log(`  ✅ Purchase created: ${purchaseResponse.data.id || 'Success'}`);
              
            } catch (purchaseError) {
              console.log(`  ❌ Purchase failed: ${purchaseError.message}`);
              
              // Try alternative: direct stock update if available
              try {
                console.log('  📝 Trying direct stock update...');
                const updateResponse = await axios.put(
                  `https://api.prokip.africa/connector/api/product/${prokipProduct.id}`,
                  { stock_quantity: log.quantity },
                  { headers: prokipHeaders }
                );
                
                console.log(`  ✅ Stock updated successfully`);
                
              } catch (updateError) {
                console.log(`  ❌ Direct update failed: ${updateError.message}`);
              }
            }
          } else {
            console.log(`  💡 Need to remove ${Math.abs(difference)} units from Prokip`);
            
            // Create a sale transaction to remove excess stock
            try {
              const saleData = {
                location_id: prokipConfig.locationId,
                contact: {
                  name: 'Stock Adjustment',
                  email: 'adjustment@example.com'
                },
                products: [{
                  product_id: prokipProduct.id,
                  sku: log.sku,
                  quantity: Math.abs(difference),
                  unit_price: 1,
                  total_price: Math.abs(difference)
                }],
                payment_method: 'cash',
                final_total: Math.abs(difference),
                transaction_date: new Date().toISOString()
              };
              
              console.log('  📝 Creating sale transaction to remove stock...');
              const saleResponse = await axios.post(
                'https://api.prokip.africa/connector/api/sell',
                saleData,
                { headers: prokipHeaders }
              );
              
              console.log(`  ✅ Sale created: ${saleResponse.data.id || 'Success'}`);
              
            } catch (saleError) {
              console.log(`  ❌ Sale failed: ${saleError.message}`);
            }
          }
        } else {
          console.log(`  ✅ Stock levels match`);
        }
        
      } catch (stockError) {
        console.log(`  ❌ Error getting Prokip stock: ${stockError.message}`);
      }
    }
    
    console.log('\n🎉 Stock synchronization fix completed!');
    
  } catch (error) {
    console.error('❌ Fix error:', error.message);
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Data:`, error.response.data);
    }
  } finally {
    await prisma.$disconnect();
  }
}

fixStockSync();
