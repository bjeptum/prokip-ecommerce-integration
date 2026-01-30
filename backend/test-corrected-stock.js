/**
 * TEST CORRECTED STOCK REDUCTION: Test the fixed sell endpoint
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCorrectedStockReduction() {
  console.log('🧪 TESTING CORRECTED STOCK REDUCTION');
  console.log('=' .repeat(50));

  try {
    const prokipService = require('./src/services/prokipService');
    const prokipConfigs = await prisma.prokipConfig.findMany();
    
    if (prokipConfigs.length === 0) {
      console.log('❌ No Prokip configurations found');
      return;
    }

    const config = prokipConfigs[0];
    
    // Get products and find test product
    const products = await prokipService.getProducts(config.locationId, config.userId);
    const testProduct = products.find(p => p.sku === '4744942');
    
    if (!testProduct) {
      console.log('❌ Test product not found');
      return;
    }

    console.log(`Test Product: ${testProduct.name} (ID: ${testProduct.id})`);
    console.log(`Current Stock: ${testProduct.stock || testProduct.qty_available || 0}`);

    // First, add some stock using a direct approach
    console.log('\n📋 1. Adding Stock Using Direct API Call');
    
    const authHeaders = await prokipService.getAuthHeaders(config.userId);
    const axios = require('axios');
    
    try {
      // Try to add stock using a simple approach
      const addStockPayload = {
        location_id: config.locationId,
        product_id: testProduct.id,
        quantity: 10
      };

      console.log('   Attempting to add 10 units to stock...');
      
      // Try different endpoints for adding stock
      const addEndpoints = [
        `${process.env.PROKIP_API}/connector/api/product/update-quantity`,
        `${process.env.PROKIP_API}/connector/api/stock/add`,
        `${process.env.PROKIP_API}/connector/api/opening-stock`
      ];
      
      let stockAdded = false;
      
      for (const endpoint of addEndpoints) {
        try {
          const response = await axios.post(endpoint, addStockPayload, { 
            headers: authHeaders, 
            timeout: 10000 
          });
          
          if (response.status === 200) {
            console.log(`   ✅ Stock added via ${endpoint}`);
            stockAdded = true;
            break;
          }
        } catch (error) {
          console.log(`   ❌ ${endpoint} failed: ${error.response?.status || error.message}`);
        }
      }
      
      if (!stockAdded) {
        console.log('   ⚠️ Could not add stock, testing with current stock...');
      }
      
      // Wait and check stock
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const updatedProducts = await prokipService.getProducts(config.locationId, config.userId);
      const updatedProduct = updatedProducts.find(p => p.sku === testProduct.sku);
      const currentStock = parseInt(updatedProduct.stock || updatedProduct.qty_available || 0);
      
      console.log(`   Current stock: ${currentStock}`);
      
      // 2. Test the corrected stock reduction
      console.log('\n📋 2. Testing Corrected Stock Reduction');
      
      try {
        console.log('   Testing stock reduction with corrected sell endpoint...');
        
        const result = await prokipService.deductStockFromProkip(
          [{ productId: testProduct.sku, product_id: testProduct.sku, quantity: 2 }],
          config.locationId,
          'Test stock reduction',
          config.userId
        );
        
        if (result.success) {
          console.log('   ✅ Stock reduction API call successful');
          console.log(`   Endpoint used: ${result.endpoint}`);
          
          // Wait and check if stock actually changed
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const finalProducts = await prokipService.getProducts(config.locationId, config.userId);
          const finalProduct = finalProducts.find(p => p.sku === testProduct.sku);
          const finalStock = parseInt(finalProduct.stock || finalProduct.qty_available || 0);
          
          console.log(`   Stock after reduction: ${finalStock}`);
          
          if (finalStock < currentStock) {
            const reduction = currentStock - finalStock;
            console.log(`   🎉 STOCK ACTUALLY REDUCED by ${reduction} units!`);
            console.log('   ✅ The corrected stock reduction method works!');
            
            // 3. Test with a webhook to ensure end-to-end works
            console.log('\n📋 3. Testing End-to-End with Webhook');
            
            await testEndToEndWebhook();
            
            return;
          } else {
            console.log('   ❌ Stock did not change - API call succeeded but no stock reduction');
            console.log('   💡 This might be a stock tracking configuration issue');
          }
        } else {
          console.log(`   ❌ Stock reduction failed: ${result.error || 'Unknown error'}`);
        }
        
      } catch (reductionError) {
        console.log(`   ❌ Stock reduction error: ${reductionError.message}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Stock management failed: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function testEndToEndWebhook() {
  console.log('\n📋 Testing End-to-End Webhook Flow');
  
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
    id: `END2END-TEST-${Date.now()}`,
    number: `WC-E2E-${Date.now()}`,
    status: 'processing',
    date_created: new Date().toISOString(),
    total: '99.99',
    customer: {
      first_name: 'End2End Test',
      email: 'e2e@test.com'
    },
    billing: {
      first_name: 'End2End Test',
      email: 'e2e@test.com'
    },
    line_items: [
      {
        id: 1,
        sku: testProduct.sku,
        name: testProduct.name,
        quantity: 1,
        price: '99.99'
      }
    ]
  };

  console.log(`   Sending end-to-end test order: ${testOrder.id}`);
  
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
      console.log('   ✅ End-to-end webhook sent');
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Check results
      const salesLog = await prisma.salesLog.findFirst({
        where: { 
          connectionId: wooConnection.id,
          orderId: testOrder.id.toString()
        }
      });

      if (salesLog && salesLog.stockDeducted) {
        console.log('   🎉 End-to-end automatic stock reduction WORKS!');
        console.log('   ✅ WooCommerce → Webhook → Stock Reduction → Database Update');
      } else {
        console.log('   ❌ End-to-end test failed');
      }
    }
  } catch (error) {
    console.log(`   ❌ End-to-end webhook failed: ${error.message}`);
  }
}

// Run the test
if (require.main === module) {
  testCorrectedStockReduction()
    .then(() => {
      console.log('\n✨ Corrected stock reduction test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test crashed:', error);
      process.exit(1);
    });
}

module.exports = { testCorrectedStockReduction };
