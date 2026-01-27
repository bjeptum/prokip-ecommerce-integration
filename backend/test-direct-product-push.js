const { PrismaClient } = require('@prisma/client');
const { createProductInStore } = require('./src/services/storeService');

const prisma = new PrismaClient();

// Sample products that match Prokip structure
const sampleProducts = [
  {
    id: 'SAMPLE001',
    name: 'Sample Product 1',
    sku: 'SAMPLE001',
    product_variations: [{
      variations: [{
        sell_price_inc_tax: 29.99
      }]
    }]
  },
  {
    id: 'SAMPLE002',
    name: 'Sample Product 2',
    sku: 'SAMPLE002',
    product_variations: [{
      variations: [{
        sell_price_inc_tax: 49.99
      }]
    }]
  }
];

async function testDirectProductPush() {
  try {
    console.log('Testing direct product push to WooCommerce...');
    
    // Get the WooCommerce connection
    const connection = await prisma.connection.findFirst({
      where: { 
        platform: 'woocommerce',
        userId: 50
      }
    });
    
    if (!connection) {
      console.log('No WooCommerce connection found');
      return;
    }
    
    console.log('Using connection:', connection.storeUrl);
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const product of sampleProducts) {
      console.log(`Processing product: ${product.name} (${product.sku})`);
      
      const storeProduct = {
        title: product.name,
        name: product.name,
        sku: product.sku,
        price: product.product_variations?.[0]?.variations?.[0]?.sell_price_inc_tax || 0,
        stock_quantity: 0
      };

      try {
        await createProductInStore(connection, storeProduct);
        
        // Create inventory log entry
        await prisma.inventoryLog.upsert({
          where: {
            connectionId_sku: {
              connectionId: connection.id,
              sku: product.sku
            }
          },
          update: {
            productId: product.id?.toString() || product.sku,
            productName: product.name,
            price: parseFloat(product.product_variations?.[0]?.variations?.[0]?.sell_price_inc_tax || 0)
          },
          create: {
            connectionId: connection.id,
            productId: product.id?.toString() || product.sku,
            productName: product.name,
            sku: product.sku,
            quantity: 0,
            price: parseFloat(product.product_variations?.[0]?.variations?.[0]?.sell_price_inc_tax || 0)
          }
        });

        results.push({ sku: product.sku, status: 'success' });
        successCount++;
        console.log(`✅ Successfully created product: ${product.name}`);
      } catch (error) {
        console.error(`❌ Failed to create product ${product.sku}:`, error.message);
        results.push({ 
          sku: product.sku, 
          status: 'error', 
          error: error.message 
        });
        errorCount++;
      }
      
      // Wait between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n=== RESULTS ===');
    console.log(`Success: ${successCount}, Errors: ${errorCount}`);
    console.log('Results:', results);
    
  } catch (error) {
    console.error('Direct push test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testDirectProductPush();
