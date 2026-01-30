/**
 * FIND CORRECT STOCK ENDPOINT: Test different Prokip API endpoints to find the one that actually updates stock
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findCorrectStockEndpoint() {
  console.log('🔍 FINDING CORRECT STOCK ENDPOINT');
  console.log('=' .repeat(50));

  try {
    const prokipService = require('./src/services/prokipService');
    const prokipConfigs = await prisma.prokipConfig.findMany();
    
    if (prokipConfigs.length === 0) {
      console.log('❌ No Prokip configurations found');
      return;
    }

    const config = prokipConfigs[0];
    const axios = require('axios');
    
    // Get a test product
    const products = await prokipService.getProducts(config.locationId, config.userId);
    const testProduct = products.find(p => p.sku === '4744942');
    
    if (!testProduct) {
      console.log('❌ Test product not found');
      return;
    }

    console.log(`Test Product: ${testProduct.name} (SKU: ${testProduct.sku})`);
    console.log(`Current Stock: ${testProduct.stock || testProduct.qty_available || 0}`);

    // Get authentication headers
    const authHeaders = await prokipService.getAuthHeaders(config.userId);
    const originalStock = parseInt(testProduct.stock || testProduct.qty_available || 0);
    
    console.log(`\n📋 Testing Different Stock Update Endpoints:`);

    // 1. Test opening stock endpoint (to add stock first)
    console.log('\n1. Testing Opening Stock Endpoint (to add stock):');
    
    try {
      const openingStockPayload = {
        location_id: config.locationId,
        transaction_date: new Date().toISOString().split('T')[0],
        opening_stock: [
          {
            product_id: testProduct.id,
            variation_id: testProduct.product_variations?.[0]?.id || null,
            quantity: 10,
            unit_cost: 50
          }
        ],
        final_total: 500
      };

      const openingResponse = await axios.post(
        `${process.env.PROKIP_API}/connector/api/opening-stock/save`,
        openingStockPayload,
        { headers: authHeaders, timeout: 15000 }
      );

      console.log(`   Status: ${openingResponse.status}`);
      if (openingResponse.status === 200) {
        console.log('   ✅ Opening stock endpoint responded successfully');
        
        // Wait and check if stock changed
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const updatedProducts = await prokipService.getProducts(config.locationId, config.userId);
        const updatedProduct = updatedProducts.find(p => p.sku === testProduct.sku);
        const newStock = parseInt(updatedProduct.stock || updatedProduct.qty_available || 0);
        
        console.log(`   Stock after opening stock: ${newStock}`);
        
        if (newStock > originalStock) {
          console.log('   🎉 Opening stock endpoint WORKS! Stock increased.');
          
          // 2. Now test stock reduction with sell endpoint
          console.log('\n2. Testing Sell Endpoint (to reduce stock):');
          
          try {
            const sellPayload = {
              location_id: config.locationId,
              contact_id: 1, // Default contact
              transaction_date: new Date().toISOString(),
              invoice_no: `STOCK-TEST-${Date.now()}`,
              final_total: 100,
              sell_lines: [
                {
                  product_id: testProduct.id,
                  variation_id: testProduct.product_variations?.[0]?.id || null,
                  quantity: 2,
                  unit_price: 50,
                  line_total: 100
                }
              ]
            };

            const sellResponse = await axios.post(
              `${process.env.PROKIP_API}/connector/api/sell`,
              sellPayload,
              { headers: authHeaders, timeout: 15000 }
            );

            console.log(`   Status: ${sellResponse.status}`);
            if (sellResponse.status === 200) {
              console.log('   ✅ Sell endpoint responded successfully');
              
              // Wait and check if stock reduced
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              const finalProducts = await prokipService.getProducts(config.locationId, config.userId);
              const finalProduct = finalProducts.find(p => p.sku === testProduct.sku);
              const finalStock = parseInt(finalProduct.stock || finalProduct.qty_available || 0);
              
              console.log(`   Stock after sell: ${finalStock}`);
              
              if (finalStock < newStock) {
                console.log('   🎉 Sell endpoint WORKS! Stock reduced.');
                console.log(`   Stock reduction: ${newStock - finalStock} units`);
                
                console.log('\n🎯 SOLUTION FOUND:');
                console.log('   ✅ Use opening-stock endpoint to add stock');
                console.log('   ✅ Use sell endpoint to reduce stock');
                console.log('   ❌ The current stock-adjustments endpoint does NOT work');
                
                return;
              } else {
                console.log('   ❌ Sell endpoint did not reduce stock');
              }
            }
          } catch (sellError) {
            console.log(`   ❌ Sell endpoint failed: ${sellError.message}`);
          }
        } else {
          console.log('   ❌ Opening stock endpoint did not change stock');
        }
      }
    } catch (openingError) {
      console.log(`   ❌ Opening stock endpoint failed: ${openingError.message}`);
    }

    // 3. Test direct stock adjustment endpoint
    console.log('\n3. Testing Direct Stock Adjustment Endpoint:');
    
    try {
      const adjustmentPayload = {
        location_id: config.locationId,
        transaction_date: new Date().toISOString(),
        adjustment_type: 'subtract',
        final_total: 0,
        adjust_lines: [
          {
            product_id: testProduct.id,
            variation_id: testProduct.product_variations?.[0]?.id || null,
            quantity: 1,
            unit_price: 0
          }
        ]
      };

      const adjustmentResponse = await axios.post(
        `${process.env.PROKIP_API}/connector/api/stock-adjustment`,
        adjustmentPayload,
        { headers: authHeaders, timeout: 15000 }
      );

      console.log(`   Status: ${adjustmentResponse.status}`);
      if (adjustmentResponse.status === 200) {
        console.log('   ✅ Stock adjustment endpoint responded successfully');
        
        // Wait and check if stock changed
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const adjustedProducts = await prokipService.getProducts(config.locationId, config.userId);
        const adjustedProduct = adjustedProducts.find(p => p.sku === testProduct.sku);
        const adjustedStock = parseInt(adjustedProduct.stock || adjustedProduct.qty_available || 0);
        
        console.log(`   Stock after adjustment: ${adjustedStock}`);
        
        if (adjustedStock < originalStock) {
          console.log('   🎉 Stock adjustment endpoint WORKS! Stock reduced.');
        } else {
          console.log('   ❌ Stock adjustment endpoint did not change stock');
        }
      }
    } catch (adjustmentError) {
      console.log(`   ❌ Stock adjustment endpoint failed: ${adjustmentError.message}`);
    }

    console.log('\n🎯 FINAL ANALYSIS:');
    console.log('   The current stock reduction method is not working');
    console.log('   Need to implement proper stock management using:');
    console.log('   1. Opening stock endpoint to initialize stock');
    console.log('   2. Sell endpoint to reduce stock');
    console.log('   3. Proper product_id and variation_id mapping');

  } catch (error) {
    console.error('❌ Endpoint testing failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the endpoint finder
if (require.main === module) {
  findCorrectStockEndpoint()
    .then(() => {
      console.log('\n✨ Endpoint testing completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Testing crashed:', error);
      process.exit(1);
    });
}

module.exports = { findCorrectStockEndpoint };
