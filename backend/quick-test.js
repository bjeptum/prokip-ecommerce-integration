/**
 * QUICK TEST: Test stock reduction after adding stock manually
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function quickTest() {
  console.log('🧪 QUICK TEST - After Adding Stock Manually');
  console.log('=' .repeat(60));

  try {
    const prokipService = require('./src/services/prokipService');
    const prokipConfigs = await prisma.prokipConfig.findMany();
    
    if (prokipConfigs.length === 0) {
      console.log('❌ No Prokip configurations found');
      return;
    }

    const config = prokipConfigs[0];
    
    // Get products and check for stock
    const products = await prokipService.getProducts(config.locationId, config.userId);
    const productsWithStock = products.filter(p => {
      const stock = parseInt(p.stock || p.qty_available || 0);
      return stock > 0;
    });
    
    console.log(`Products with stock > 0: ${productsWithStock.length}`);
    
    if (productsWithStock.length === 0) {
      console.log('❌ Still no products with stock');
      console.log('💡 Please add stock to products in Prokip dashboard first');
      return;
    }
    
    const testProduct = productsWithStock[0];
    console.log(`\nTesting with: ${testProduct.name}`);
    console.log(`SKU: ${testProduct.sku}`);
    console.log(`Current stock: ${testProduct.stock || testProduct.qty_available || 0}`);
    
    // Test stock reduction
    const result = await prokipService.deductStockFromProkip(
      [{ productId: testProduct.sku, product_id: testProduct.sku, quantity: 2 }],
      config.locationId,
      'Quick test',
      config.userId
    );
    
    if (result.success) {
      console.log('✅ Stock reduction successful!');
      console.log('🎉 Your system is working!');
      
      // Test webhook
      const testOrder = {
        id: `QUICK-TEST-${Date.now()}`,
        number: `WC-QUICK-${Date.now()}`,
        status: 'processing',
        date_created: new Date().toISOString(),
        total: '99.98',
        customer: { first_name: 'Quick', email: 'quick@test.com' },
        billing: { first_name: 'Quick', email: 'quick@test.com' },
        line_items: [{
          id: 1,
          sku: testProduct.sku,
          name: testProduct.name,
          quantity: 2,
          price: '49.99'
        }]
      };

      const axios = require('axios');
      const response = await axios.post('http://localhost:3000/webhooks/woocommerce', testOrder, {
        headers: {
          'Content-Type': 'application/json',
          'X-WC-Webhook-Topic': 'order.created',
          'X-WC-Webhook-Source': 'https://learn.prokip.africa'
        }
      });

      if (response.status === 200) {
        console.log('✅ Webhook test successful');
        console.log('🎉 COMPLETE SUCCESS - Everything is working!');
      }
    }
    
  } catch (error) {
    console.error('❌ Quick test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the quick test
if (require.main === module) {
  quickTest()
    .then(() => {
      console.log('\n✨ Quick test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test crashed:', error);
      process.exit(1);
    });
}

module.exports = { quickTest };
