/**
 * SIMPLE STOCK SOLUTION: Add stock to existing product and test
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function simpleStockSolution() {
  console.log('🔧 SIMPLE STOCK SOLUTION');
  console.log('=' .repeat(50));

  try {
    const prokipService = require('./src/services/prokipService');
    const prokipConfigs = await prisma.prokipConfig.findMany();
    
    if (prokipConfigs.length === 0) {
      console.log('❌ No Prokip configurations found');
      return;
    }

    const config = prokipConfigs[0];
    console.log(`User ID: ${config.userId}, Location: ${config.locationId}`);
    
    // 1. Get existing products
    console.log('\n📋 1. Getting Existing Products');
    
    const products = await prokipService.getProducts(config.locationId, config.userId);
    console.log(`Found ${products.length} products`);
    
    // Find a product to work with
    const testProduct = products.find(p => p.sku === '4744942') || products[0];
    
    if (!testProduct) {
      console.log('❌ No products found');
      return;
    }
    
    console.log(`\nUsing product: ${testProduct.name}`);
    console.log(`SKU: ${testProduct.sku}`);
    console.log(`Current stock: ${testProduct.stock || testProduct.qty_available || 0}`);
    
    // 2. Test inventory sync fix
    console.log('\n📋 2. Testing Fixed Inventory Sync');
    
    try {
      const axios = require('axios');
      const authHeaders = await prokipService.getAuthHeaders(config.userId);
      
      // Call the fixed inventory sync endpoint
      const response = await axios.post('http://localhost:3000/sync/inventory', {
        connectionId: 10 // Your WooCommerce connection ID
      }, {
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      
      if (response.status === 200) {
        console.log('✅ Inventory sync successful');
        console.log('Results:', response.data);
      }
    } catch (syncError) {
      console.log(`❌ Inventory sync failed: ${syncError.response?.status || syncError.message}`);
      if (syncError.response?.data) {
        console.log('Error details:', syncError.response.data);
      }
    }
    
    // 3. Manual stock addition via purchase order
    console.log('\n📋 3. Adding Stock via Purchase Order');
    
    try {
      const axios = require('axios');
      const authHeaders = await prokipService.getAuthHeaders(config.userId);
      
      const purchasePayload = {
        location_id: config.locationId,
        contact_id: 1,
        transaction_date: new Date().toISOString(),
        invoice_no: `STOCK-ADD-${Date.now()}`,
        status: 'received',
        type: 'purchase',
        payment_status: 'paid',
        final_total: 5000,
        purchase_lines: [{
          product_id: testProduct.id,
          variation_id: testProduct.product_variations?.[0]?.id || null,
          quantity: 100,
          unit_price: 50,
          line_total: 5000
        }]
      };

      console.log('Creating purchase order to add 100 units...');
      
      const purchaseResponse = await axios.post(
        `${process.env.PROKIP_API}/connector/api/purchase`,
        purchasePayload,
        { headers: authHeaders, timeout: 15000 }
      );

      if (purchaseResponse.status === 200) {
        console.log('✅ Purchase order created successfully');
        
        // Wait and check stock
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const updatedProducts = await prokipService.getProducts(config.locationId, config.userId);
        const updatedProduct = updatedProducts.find(p => p.sku === testProduct.sku);
        const newStock = parseInt(updatedProduct.stock || updatedProduct.qty_available || 0);
        
        console.log(`Stock after purchase: ${newStock}`);
        
        if (newStock > 0) {
          console.log('🎉 Stock added successfully!');
          
          // 4. Test stock reduction
          console.log('\n📋 4. Testing Stock Reduction');
          await testStockReduction(updatedProduct, config);
          
          // 5. Test WooCommerce webhook
          console.log('\n📋 5. Testing WooCommerce Webhook');
          await testWooCommerceWebhook(updatedProduct, config);
          
        } else {
          console.log('❌ Stock still 0 after purchase');
        }
      }
      
    } catch (purchaseError) {
      console.log(`❌ Purchase order failed: ${purchaseError.response?.status || purchaseError.message}`);
    }

  } catch (error) {
    console.error('❌ Simple stock solution failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function testStockReduction(product, config) {
  console.log(`Testing stock reduction for: ${product.name}`);
  
  const originalStock = parseInt(product.stock || product.qty_available || 0);
  console.log(`Original stock: ${originalStock}`);
  
  try {
    const prokipService = require('./src/services/prokipService');
    const result = await prokipService.deductStockFromProkip(
      [{ productId: product.sku, product_id: product.sku, quantity: 5 }],
      config.locationId,
      'Test stock reduction',
      config.userId
    );
    
    if (result.success) {
      console.log('✅ Stock reduction API call successful');
      console.log(`Endpoint used: ${result.endpoint}`);
      
      // Wait and check new stock
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const updatedProducts = await prokipService.getProducts(config.locationId, config.userId);
      const updatedProduct = updatedProducts.find(p => p.sku === product.sku);
      const newStock = parseInt(updatedProduct.stock || updatedProduct.qty_available || 0);
      
      console.log(`New stock: ${newStock}`);
      
      if (newStock < originalStock) {
        const reduction = originalStock - newStock;
        console.log(`🎉 STOCK REDUCTION WORKS! Reduced by ${reduction} units`);
        return true;
      } else {
        console.log('❌ Stock did not change');
        return false;
      }
    } else {
      console.log(`❌ Stock reduction failed: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Stock reduction error: ${error.message}`);
    return false;
  }
}

async function testWooCommerceWebhook(product, config) {
  console.log(`Testing WooCommerce webhook with: ${product.name}`);
  
  const testOrder = {
    id: `STOCK-TEST-${Date.now()}`,
    number: `WC-STOCK-${Date.now()}`,
    status: 'processing',
    date_created: new Date().toISOString(),
    total: '249.95',
    customer: {
      first_name: 'Stock Test',
      email: 'stock@test.com'
    },
    billing: {
      first_name: 'Stock Test',
      email: 'stock@test.com'
    },
    line_items: [
      {
        id: 1,
        sku: product.sku,
        name: product.name,
        quantity: 5,
        price: '49.99'
      }
    ]
  };

  console.log(`Sending webhook for order: ${testOrder.id}`);
  
  const axios = require('axios');
  
  try {
    const response = await axios.post('http://localhost:3000/webhooks/woocommerce', testOrder, {
      headers: {
        'Content-Type': 'application/json',
        'X-WC-Webhook-Topic': 'order.created',
        'X-WC-Webhook-Source': 'https://learn.prokip.africa'
      },
      timeout: 15000
    });

    if (response.status === 200) {
      console.log('✅ Webhook sent successfully');
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Check results
      const salesLog = await prisma.salesLog.findFirst({
        where: { 
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

// Run the simple solution
if (require.main === module) {
  simpleStockSolution()
    .then(() => {
      console.log('\n✨ Simple stock solution completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Solution crashed:', error);
      process.exit(1);
    });
}

module.exports = { simpleStockSolution };
