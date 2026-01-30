/**
 * CHECK REAL PROKIP STOCK: Verify actual stock levels and test reduction
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkRealProkipStock() {
  console.log('🔍 CHECKING REAL PROKIP STOCK LEVELS');
  console.log('=' .repeat(60));

  try {
    const prokipService = require('./src/services/prokipService');
    const prokipConfigs = await prisma.prokipConfig.findMany();
    
    if (prokipConfigs.length === 0) {
      console.log('❌ No Prokip configurations found');
      return;
    }

    const config = prokipConfigs[0];
    console.log(`User ID: ${config.userId}, Location: ${config.locationId}`);

    // 1. Get all products with their actual stock levels
    console.log('\n📋 1. Getting All Products with Stock Levels');
    
    const products = await prokipService.getProducts(config.locationId, config.userId);
    console.log(`Total products found: ${products.length}`);
    
    // Show products that have stock
    const productsWithStock = products.filter(p => {
      const stock = parseInt(p.stock || p.qty_available || 0);
      return stock > 0;
    });
    
    console.log(`Products with stock > 0: ${productsWithStock.length}`);
    
    if (productsWithStock.length === 0) {
      console.log('❌ No products have stock in Prokip');
      console.log('💡 This is why stock reduction is not working');
      return;
    }
    
    // Show top products with stock
    console.log('\nProducts with stock:');
    productsWithStock.slice(0, 5).forEach((product, index) => {
      const stock = parseInt(product.stock || product.qty_available || 0);
      console.log(`  ${index + 1}. ${product.name} (SKU: ${product.sku}) - Stock: ${stock}`);
    });

    // 2. Test stock reduction with a product that actually has stock
    console.log('\n📋 2. Testing Stock Reduction with Product That Has Stock');
    
    const testProduct = productsWithStock[0]; // Use first product with stock
    const originalStock = parseInt(testProduct.stock || testProduct.qty_available || 0);
    
    console.log(`Testing with: ${testProduct.name}`);
    console.log(`Original stock: ${originalStock}`);
    
    try {
      const result = await prokipService.deductStockFromProkip(
        [{ productId: testProduct.sku, product_id: testProduct.sku, quantity: 1 }],
        config.locationId,
        'Test stock reduction with existing stock',
        config.userId
      );
      
      if (result.success) {
        console.log('✅ Stock reduction API call successful');
        console.log(`Endpoint used: ${result.endpoint}`);
        
        // Wait and check if stock actually changed
        console.log('⏳ Waiting 3 seconds for stock to update...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Get updated products
        const updatedProducts = await prokipService.getProducts(config.locationId, config.userId);
        const updatedProduct = updatedProducts.find(p => p.sku === testProduct.sku);
        const newStock = parseInt(updatedProduct.stock || updatedProduct.qty_available || 0);
        
        console.log(`New stock: ${newStock}`);
        
        if (newStock < originalStock) {
          const reduction = originalStock - newStock;
          console.log(`🎉 STOCK ACTUALLY REDUCED by ${reduction} units!`);
          console.log('✅ The stock reduction system is working!');
          
          // 3. Test with WooCommerce webhook
          console.log('\n📋 3. Testing WooCommerce Webhook with Real Stock');
          await testWooCommerceWebhook(testProduct);
          
        } else {
          console.log('❌ Stock did not change despite API success');
          console.log('💡 This indicates the API endpoint is not actually updating stock');
          
          // 4. Try alternative stock reduction method
          console.log('\n📋 4. Trying Alternative Stock Reduction Method');
          await tryAlternativeMethod(testProduct, config);
        }
      } else {
        console.log(`❌ Stock reduction failed: ${result.error}`);
      }
      
    } catch (error) {
      console.log(`❌ Stock reduction error: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Stock check failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function testWooCommerceWebhook(testProduct) {
  console.log('Testing complete WooCommerce webhook flow...');
  
  const wooConnection = await prisma.connection.findFirst({
    where: { platform: 'woocommerce' }
  });

  if (!wooConnection) {
    console.log('❌ No WooCommerce connection found');
    return;
  }

  const testOrder = {
    id: `REAL-STOCK-TEST-${Date.now()}`,
    number: `WC-REAL-${Date.now()}`,
    status: 'processing',
    date_created: new Date().toISOString(),
    total: '99.99',
    customer: {
      first_name: 'Real Stock Test',
      email: 'realstock@test.com'
    },
    billing: {
      first_name: 'Real Stock Test',
      email: 'realstock@test.com'
    },
    line_items: [
      {
        id: 1,
        sku: testProduct.sku, // Use real SKU with stock
        name: testProduct.name,
        quantity: 1,
        price: '99.99'
      }
    ]
  };

  console.log(`Sending webhook for order: ${testOrder.id}`);
  console.log(`Product SKU: ${testProduct.sku} (has stock)`);
  
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
      console.log('✅ Webhook sent successfully');
      
      // Wait for processing
      console.log('⏳ Waiting 10 seconds for webhook processing...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Check results
      const salesLog = await prisma.salesLog.findFirst({
        where: { 
          connectionId: wooConnection.id,
          orderId: testOrder.id.toString()
        }
      });

      if (salesLog && salesLog.stockDeducted) {
        console.log('🎉 COMPLETE SUCCESS!');
        console.log('✅ WooCommerce webhook processed');
        console.log('✅ Stock deducted from Prokip');
        console.log('✅ Database updated correctly');
        console.log('✅ Automatic stock reduction is working!');
      } else {
        console.log('❌ Webhook processed but stock not deducted');
      }
    }
  } catch (error) {
    console.log(`❌ Webhook test failed: ${error.message}`);
  }
}

async function tryAlternativeMethod(testProduct, config) {
  console.log('Trying direct sell endpoint method...');
  
  const prokipService = require('./src/services/prokipService');
  const authHeaders = await prokipService.getAuthHeaders(config.userId);
  const axios = require('axios');
  
  try {
    // Create a proper sell transaction
    const sellPayload = {
      location_id: parseInt(config.locationId),
      contact_id: 1,
      transaction_date: new Date().toISOString(),
      invoice_no: `DIRECT-SELL-${Date.now()}`,
      status: 'final',
      type: 'sell',
      payment_status: 'paid',
      final_total: 99.99,
      discount_amount: 0,
      discount_type: 'fixed',
      sell_lines: [{
        product_id: parseInt(testProduct.id),
        variation_id: testProduct.product_variations?.[0]?.id || null,
        quantity: 1,
        unit_price: 99.99,
        line_total: 99.99
      }],
      payments: [{
        method: 'cash',
        amount: 99.99,
        paid_on: new Date().toISOString()
      }]
    };

    console.log('Sending direct sell transaction...');
    
    const response = await axios.post(
      `${process.env.PROKIP_API}/connector/api/sell`,
      sellPayload,
      { headers: authHeaders, timeout: 15000 }
    );

    if (response.status === 200) {
      console.log('✅ Direct sell transaction successful');
      
      // Wait and check stock
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const updatedProducts = await prokipService.getProducts(config.locationId, config.userId);
      const updatedProduct = updatedProducts.find(p => p.sku === testProduct.sku);
      const newStock = parseInt(updatedProduct.stock || updatedProduct.qty_available || 0);
      
      console.log(`Stock after direct sell: ${newStock}`);
      
      // If this works, we need to update the stock reduction method
      if (newStock < (parseInt(testProduct.stock || testProduct.qty_available || 0))) {
        console.log('🎉 Direct sell method works!');
        console.log('💡 Need to update stock reduction to use this method');
      }
    }
  } catch (error) {
    console.log(`❌ Direct sell failed: ${error.message}`);
  }
}

// Run the stock check
if (require.main === module) {
  checkRealProkipStock()
    .then(() => {
      console.log('\n✨ Real stock check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Check crashed:', error);
      process.exit(1);
    });
}

module.exports = { checkRealProkipStock };
