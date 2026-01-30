/**
 * ADD STOCK TO PRODUCTS: Initialize stock for all products
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function addStockToProducts() {
  console.log('🔧 ADDING STOCK TO PRODUCTS');
  console.log('=' .repeat(50));

  try {
    const prokipService = require('./src/services/prokipService');
    const prokipConfigs = await prisma.prokipConfig.findMany();
    
    if (prokipConfigs.length === 0) {
      console.log('❌ No Prokip configurations found');
      return;
    }

    const config = prokipConfigs[0];
    const authHeaders = await prokipService.getAuthHeaders(config.userId);
    
    // Get all products
    const products = await prokipService.getProducts(config.locationId, config.userId);
    console.log(`Found ${products.length} products to add stock to`);
    
    // Add stock to first 5 products as example
    const productsToStock = products.slice(0, 5);
    
    for (const product of productsToStock) {
      console.log(`\nAdding stock to: ${product.name} (SKU: ${product.sku})`);
      
      try {
        // Method 1: Try opening stock endpoint
        const openingStockPayload = {
          location_id: config.locationId,
          transaction_date: new Date().toISOString().split('T')[0],
          opening_stock: [
            {
              product_id: product.id,
              variation_id: product.product_variations?.[0]?.id || null,
              quantity: 50, // Add 50 units
              unit_cost: 50
            }
          ],
          final_total: 2500
        };

        const response = await axios.post(
          `${process.env.PROKIP_API}/connector/api/opening-stock`,
          openingStockPayload,
          { headers: authHeaders, timeout: 15000 }
        );

        if (response.status === 200 || response.status === 201) {
          console.log(`  ✅ Stock added successfully`);
        }
        
      } catch (error) {
        console.log(`  ❌ Opening stock failed: ${error.response?.status || error.message}`);
        
        // Method 2: Try direct product update
        try {
          const updatePayload = {
            id: product.id,
            opening_stock: 50,
            opening_stock_date: new Date().toISOString().split('T')[0]
          };

          const updateResponse = await axios.put(
            `${process.env.PROKIP_API}/connector/api/product/${product.id}`,
            updatePayload,
            { headers: authHeaders, timeout: 15000 }
          );

          if (updateResponse.status === 200) {
            console.log(`  ✅ Stock added via product update`);
          }
        } catch (updateError) {
          console.log(`  ❌ Product update failed: ${updateError.response?.status || updateError.message}`);
        }
      }
      
      // Wait between products
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Verify stock was added
    console.log('\n📋 Verifying stock was added...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const updatedProducts = await prokipService.getProducts(config.locationId, config.userId);
    const productsWithStock = updatedProducts.filter(p => {
      const stock = parseInt(p.stock || p.qty_available || 0);
      return stock > 0;
    });
    
    console.log(`Products with stock after update: ${productsWithStock.length}`);
    
    if (productsWithStock.length > 0) {
      console.log('\n🎉 SUCCESS! Products now have stock:');
      productsWithStock.forEach(p => {
        const stock = parseInt(p.stock || p.qty_available || 0);
        console.log(`  - ${p.name} (SKU: ${p.sku}) - Stock: ${stock}`);
      });
      
      console.log('\n✅ Stock reduction will now work!');
      console.log('💡 Test with a WooCommerce sale to see automatic stock reduction');
      
    } else {
      console.log('\n❌ Stock still not added via API');
      console.log('💡 Please add stock manually in Prokip dashboard');
    }

  } catch (error) {
    console.error('❌ Stock addition failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the stock addition
if (require.main === module) {
  addStockToProducts()
    .then(() => {
      console.log('\n✨ Stock addition completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Stock addition crashed:', error);
      process.exit(1);
    });
}

module.exports = { addStockToProducts };
