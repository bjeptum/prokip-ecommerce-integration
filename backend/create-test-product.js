/**
 * CREATE TEST PRODUCT WITH STOCK: Add a new product to Prokip with opening stock
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function createTestProductWithStock() {
  console.log('🔧 CREATING TEST PRODUCT WITH OPENING STOCK');
  console.log('=' .repeat(60));

  try {
    const prokipConfigs = await prisma.prokipConfig.findMany();
    
    if (prokipConfigs.length === 0) {
      console.log('❌ No Prokip configurations found');
      return;
    }

    const config = prokipConfigs[0];
    const authHeaders = await getAuthHeaders(config.userId);
    
    // 1. Create a new test product
    console.log('\n📋 1. Creating New Test Product');
    
    const newProduct = {
      name: 'Test Stock Reduction Product',
      sku: `TEST-${Date.now()}`,
      enable_stock: 1,
      alert_quantity: 5,
      default_purchase_price: 25,
      default_sell_price: 49.99,
      unit_id: 1,
      category_id: null,
      sub_category_id: null,
      brand_id: null,
      business_id: 1,
      barcode_type: 'C128',
      description: 'Test product for stock reduction verification',
      opening_stock: 100,
      opening_stock_date: new Date().toISOString().split('T')[0]
    };

    console.log(`Creating product: ${newProduct.name}`);
    console.log(`SKU: ${newProduct.sku}`);
    console.log(`Opening Stock: ${newProduct.opening_stock}`);
    
    try {
      const createResponse = await axios.post(
        `${process.env.PROKIP_API}/connector/api/product`,
        newProduct,
        { headers: authHeaders, timeout: 15000 }
      );

      if (createResponse.status === 200 || createResponse.status === 201) {
        console.log('✅ Product created successfully');
        
        if (createResponse.data && createResponse.data.data && createResponse.data.data.id) {
          const productId = createResponse.data.data.id;
          console.log(`Product ID: ${productId}`);
          
          // 2. Verify the product was created with stock
          console.log('\n📋 2. Verifying Product Stock');
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const prokipService = require('./src/services/prokipService');
          const products = await prokipService.getProducts(config.locationId, config.userId);
          const createdProduct = products.find(p => p.sku === newProduct.sku);
          
          if (createdProduct) {
            const stock = parseInt(createdProduct.stock || createdProduct.qty_available || 0);
            console.log(`Product found: ${createdProduct.name}`);
            console.log(`Current stock: ${stock}`);
            
            if (stock > 0) {
              console.log('🎉 Product has stock! Ready for testing');
              
              // 3. Test stock reduction
              console.log('\n📋 3. Testing Stock Reduction');
              await testStockReduction(createdProduct, config);
              
              // 4. Push to WooCommerce
              console.log('\n📋 4. Pushing Product to WooCommerce');
              await pushToWooCommerce(createdProduct, config);
              
            } else {
              console.log('❌ Product created but no stock - trying alternative method');
              
              // Try to add stock via purchase order
              await addStockViaPurchase(createdProduct, config, authHeaders);
            }
          } else {
            console.log('❌ Product not found in product list');
          }
        }
      }
      
    } catch (createError) {
      console.log(`❌ Product creation failed: ${createError.response?.status || createError.message}`);
      
      if (createError.response?.data) {
        console.log('Error details:', createError.response.data);
      }
    }

  } catch (error) {
    console.error('❌ Test product creation failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function getAuthHeaders(userId) {
  const prokipService = require('./src/services/prokipService');
  return await prokipService.getAuthHeaders(userId);
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

async function pushToWooCommerce(product, config) {
  console.log(`Pushing product to WooCommerce: ${product.name}`);
  
  try {
    const wooConnection = await prisma.connection.findFirst({
      where: { platform: 'woocommerce' }
    });
    
    if (!wooConnection) {
      console.log('❌ No WooCommerce connection found');
      return;
    }
    
    const { decryptCredentials } = require('./src/services/storeService');
    const { consumerKey, consumerSecret } = decryptCredentials(wooConnection);
    const axios = require('axios');
    
    const wooProduct = {
      name: product.name,
      sku: product.sku,
      type: 'simple',
      status: 'publish',
      regular_price: '49.99',
      manage_stock: true,
      stock_quantity: parseInt(product.stock || product.qty_available || 0),
      description: product.description || 'Test product for stock reduction'
    };
    
    const auth = {
      username: consumerKey,
      password: consumerSecret
    };
    
    const response = await axios.post(
      `${wooConnection.storeUrl}/wp-json/wc/v3/products`,
      wooProduct,
      {
        auth,
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );
    
    if (response.status === 200 || response.status === 201) {
      console.log('✅ Product pushed to WooCommerce successfully');
      console.log(`WooCommerce Product ID: ${response.data.id}`);
      console.log(`Stock in WooCommerce: ${response.data.stock_quantity}`);
      
      return response.data;
    }
  } catch (wooError) {
    console.log(`❌ WooCommerce push failed: ${wooError.response?.status || wooError.message}`);
    if (wooError.response?.data) {
      console.log('WooCommerce error:', wooError.response.data);
    }
  }
}

async function addStockViaPurchase(product, config, authHeaders) {
  console.log('Adding stock via purchase order...');
  
  try {
    const purchasePayload = {
      location_id: config.locationId,
      contact_id: 1,
      transaction_date: new Date().toISOString(),
      invoice_no: `STOCK-INIT-${Date.now()}`,
      status: 'received',
      type: 'purchase',
      payment_status: 'paid',
      final_total: 2500,
      purchase_lines: [{
        product_id: product.id,
        variation_id: product.product_variations?.[0]?.id || null,
        quantity: 50,
        unit_price: 50,
        line_total: 2500
      }]
    };

    const response = await axios.post(
      `${process.env.PROKIP_API}/connector/api/purchase`,
      purchasePayload,
      { headers: authHeaders, timeout: 15000 }
    );

    if (response.status === 200) {
      console.log('✅ Purchase order created to add stock');
      
      // Wait and check stock
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const prokipService = require('./src/services/prokipService');
      const updatedProducts = await prokipService.getProducts(config.locationId, config.userId);
      const updatedProduct = updatedProducts.find(p => p.sku === product.sku);
      const newStock = parseInt(updatedProduct.stock || updatedProduct.qty_available || 0);
      
      console.log(`Stock after purchase: ${newStock}`);
      
      if (newStock > 0) {
        console.log('🎉 Stock added via purchase order!');
        
        // Test stock reduction now
        await testStockReduction(updatedProduct, config);
      }
    }
  } catch (purchaseError) {
    console.log(`❌ Purchase order failed: ${purchaseError.message}`);
  }
}

// Run the test product creation
if (require.main === module) {
  createTestProductWithStock()
    .then(() => {
      console.log('\n✨ Test product creation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Creation crashed:', error);
      process.exit(1);
    });
}

module.exports = { createTestProductWithStock };
