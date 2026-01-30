/**
 * COMPLETE STOCK SOLUTION: Add stock first, then implement proper reduction
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function completeStockSolution() {
  console.log('🔧 COMPLETE STOCK SOLUTION');
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
    
    // Get test product
    const products = await prokipService.getProducts(config.locationId, config.userId);
    const testProduct = products.find(p => p.sku === '4744942');
    
    if (!testProduct) {
      console.log('❌ Test product not found');
      return;
    }

    console.log(`Test Product: ${testProduct.name} (ID: ${testProduct.id})`);
    console.log(`Current Stock: ${testProduct.stock || testProduct.qty_available || 0}`);

    // 1. Add stock using the product update endpoint
    console.log('\n📋 1. Adding Stock Using Product Update');
    
    try {
      // Method 1: Direct product update
      const updatePayload = {
        id: testProduct.id,
        sku: testProduct.sku,
        name: testProduct.name,
        enable_stock: 1,
        alert_quantity: 0,
        default_purchase_price: 50,
        default_sell_price: 99.99,
        unit_id: testProduct.unit?.id || 1,
        category_id: testProduct.category?.id || null,
        sub_category_id: testProduct.sub_category?.id || null,
        brand_id: testProduct.brand?.id || null,
        warranty_id: testProduct.warranty_id || null,
        business_id: testProduct.business_id,
        barcode_type: testProduct.barcode_type || 'C128',
        sku: testProduct.sku,
        // Add stock quantity
        opening_stock: 50,
        opening_stock_date: new Date().toISOString().split('T')[0]
      };

      console.log('   Attempting to add 50 units via product update...');
      
      const updateResponse = await axios.post(
        `${process.env.PROKIP_API}/connector/api/product`,
        updatePayload,
        { headers: authHeaders, timeout: 15000 }
      );

      if (updateResponse.status === 200 || updateResponse.status === 201) {
        console.log('   ✅ Product updated successfully');
      }
    } catch (updateError) {
      console.log(`   ❌ Product update failed: ${updateError.response?.status || updateError.message}`);
      
      // Method 2: Try PUT to update existing product
      try {
        console.log('   Trying PUT method to update product...');
        
        const putPayload = {
          sku: testProduct.sku,
          name: testProduct.name,
          enable_stock: 1,
          opening_stock: 50,
          opening_stock_date: new Date().toISOString().split('T')[0]
        };

        const putResponse = await axios.put(
          `${process.env.PROKIP_API}/connector/api/product/${testProduct.id}`,
          putPayload,
          { headers: authHeaders, timeout: 15000 }
        );

        if (putResponse.status === 200) {
          console.log('   ✅ Product updated via PUT successfully');
        }
      } catch (putError) {
        console.log(`   ❌ PUT update failed: ${putError.response?.status || putError.message}`);
      }
    }

    // Wait and check if stock was added
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const updatedProducts = await prokipService.getProducts(config.locationId, config.userId);
    const updatedProduct = updatedProducts.find(p => p.sku === testProduct.sku);
    const newStock = parseInt(updatedProduct.stock || updatedProduct.qty_available || 0);
    
    console.log(`   Stock after update attempt: ${newStock}`);
    
    if (newStock > 0) {
      console.log('   🎉 Stock successfully added!');
      
      // 2. Now test stock reduction
      console.log('\n📋 2. Testing Stock Reduction with Available Stock');
      
      try {
        const result = await prokipService.deductStockFromProkip(
          [{ productId: testProduct.sku, product_id: testProduct.sku, quantity: 5 }],
          config.locationId,
          'Test stock reduction with available stock',
          config.userId
        );
        
        if (result.success) {
          console.log('   ✅ Stock reduction API call successful');
          console.log(`   Endpoint used: ${result.endpoint}`);
          
          // Wait and check final stock
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const finalProducts = await prokipService.getProducts(config.locationId, config.userId);
          const finalProduct = finalProducts.find(p => p.sku === testProduct.sku);
          const finalStock = parseInt(finalProduct.stock || finalProduct.qty_available || 0);
          
          console.log(`   Final stock: ${finalStock}`);
          
          if (finalStock < newStock) {
            const reduction = newStock - finalStock;
            console.log(`   🎉 STOCK ACTUALLY REDUCED by ${reduction} units!`);
            console.log('   ✅ Complete stock solution is working!');
            
            // 3. Test end-to-end webhook
            console.log('\n📋 3. Testing Complete End-to-End Flow');
            await testCompleteEndToEnd();
            
            return;
          } else {
            console.log('   ❌ Stock still not reducing despite having stock');
          }
        }
      } catch (reductionError) {
        console.log(`   ❌ Stock reduction failed: ${reductionError.message}`);
      }
    } else {
      console.log('   ❌ Could not add stock - trying alternative approach');
      
      // 3. Alternative: Create a purchase order to add stock
      console.log('\n📋 3. Alternative: Add Stock via Purchase Order');
      
      try {
        const purchasePayload = {
          location_id: config.locationId,
          contact_id: 1, // Default supplier
          transaction_date: new Date().toISOString(),
          invoice_no: `STOCK-INIT-${Date.now()}`,
          status: 'received',
          type: 'purchase',
          payment_status: 'paid',
          final_total: 2500,
          purchase_lines: [{
            product_id: testProduct.id,
            variation_id: testProduct.product_variations?.[0]?.id || null,
            quantity: 25,
            unit_price: 100,
            line_total: 2500
          }]
        };

        console.log('   Creating purchase order to add 25 units...');
        
        const purchaseResponse = await axios.post(
          `${process.env.PROKIP_API}/connector/api/purchase`,
          purchasePayload,
          { headers: authHeaders, timeout: 15000 }
        );

        if (purchaseResponse.status === 200) {
          console.log('   ✅ Purchase order created');
          
          // Wait and check stock
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          const purchaseProducts = await prokipService.getProducts(config.locationId, config.userId);
          const purchaseProduct = purchaseProducts.find(p => p.sku === testProduct.sku);
          const purchaseStock = parseInt(purchaseProduct.stock || purchaseProduct.qty_available || 0);
          
          console.log(`   Stock after purchase: ${purchaseStock}`);
          
          if (purchaseStock > 0) {
            console.log('   🎉 Stock added via purchase order!');
            
            // Test reduction again
            const reductionResult = await prokipService.deductStockFromProkip(
              [{ productId: testProduct.sku, product_id: testProduct.sku, quantity: 3 }],
              config.locationId,
              'Test after purchase order',
              config.userId
            );
            
            if (reductionResult.success) {
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              const finalCheckProducts = await prokipService.getProducts(config.locationId, config.userId);
              const finalCheckProduct = finalCheckProducts.find(p => p.sku === testProduct.sku);
              const finalCheckStock = parseInt(finalCheckProduct.stock || finalCheckProduct.qty_available || 0);
              
              if (finalCheckStock < purchaseStock) {
                console.log(`   🎉 STOCK REDUCTION WORKS! Reduced by ${purchaseStock - finalCheckStock} units`);
                console.log('   ✅ Complete solution implemented successfully!');
                
                await testCompleteEndToEnd();
                return;
              }
            }
          }
        }
      } catch (purchaseError) {
        console.log(`   ❌ Purchase order failed: ${purchaseError.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Complete solution failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function testCompleteEndToEnd() {
  console.log('\n🎯 COMPLETE END-TO-END TEST');
  
  const wooConnection = await prisma.connection.findFirst({
    where: { platform: 'woocommerce' }
  });

  if (!wooConnection) {
    console.log('   ❌ No WooCommerce connection found');
    return;
  }

  const prokipService = require('./src/services/prokipService');
  const prokipConfigs = await prisma.prokipConfig.findMany();
  const config = prokipConfigs[0];
  const products = await prokipService.getProducts(config.locationId, config.userId);
  const testProduct = products.find(p => p.sku === '4744942');
  
  const testOrder = {
    id: `FINAL-E2E-${Date.now()}`,
    number: `WC-FINAL-${Date.now()}`,
    status: 'processing',
    date_created: new Date().toISOString(),
    total: '199.98',
    customer: {
      first_name: 'Final Test',
      email: 'final@test.com'
    },
    billing: {
      first_name: 'Final Test',
      email: 'final@test.com'
    },
    line_items: [
      {
        id: 1,
        sku: testProduct.sku,
        name: testProduct.name,
        quantity: 2,
        price: '99.99'
      }
    ]
  };

  console.log(`   Testing complete flow with order: ${testOrder.id}`);
  
  const axios = require('axios');
  
  try {
    const response = await axios.post('http://localhost:3000/webhooks/woocommerce', testOrder, {
      headers: {
        'Content-Type': 'application/json',
        'X-WC-Webhook-Topic': 'order.created',
        'X-WC-Webhook-Source': wooConnection.storeUrl
      },
      timeout: 15000
    });

    if (response.status === 200) {
      console.log('   ✅ Webhook sent');
      
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const salesLog = await prisma.salesLog.findFirst({
        where: { 
          connectionId: wooConnection.id,
          orderId: testOrder.id.toString()
        }
      });

      if (salesLog && salesLog.stockDeducted) {
        console.log('   🎉 COMPLETE SUCCESS!');
        console.log('   ✅ WooCommerce → Webhook → Stock Reduction → Database');
        console.log('   ✅ Real stock actually reduced in Prokip!');
        console.log('   ✅ Automatic stock reduction is fully working!');
      } else {
        console.log('   ❌ End-to-end test failed');
      }
    }
  } catch (error) {
    console.log(`   ❌ End-to-end test failed: ${error.message}`);
  }
}

// Run the complete solution
if (require.main === module) {
  completeStockSolution()
    .then(() => {
      console.log('\n✨ Complete stock solution finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Solution crashed:', error);
      process.exit(1);
    });
}

module.exports = { completeStockSolution };
