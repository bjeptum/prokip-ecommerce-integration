/**
 * IMPLEMENT CORRECT STOCK REDUCTION: Use the working sell endpoint to actually reduce stock
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function implementCorrectStockReduction() {
  console.log('🔧 IMPLEMENTING CORRECT STOCK REDUCTION');
  console.log('=' .repeat(60));

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

    // First, add some stock using opening stock
    console.log('\n📋 1. Adding Stock Using Opening Stock');
    
    const authHeaders = await prokipService.getAuthHeaders(config.userId);
    
    try {
      const openingStockPayload = {
        location_id: config.locationId,
        transaction_date: new Date().toISOString().split('T')[0],
        opening_stock: [
          {
            product_id: testProduct.id,
            variation_id: testProduct.product_variations?.[0]?.id || null,
            quantity: 20,
            unit_cost: 50
          }
        ],
        final_total: 1000
      };

      console.log('   Adding 20 units to stock...');
      
      const openingResponse = await axios.post(
        `${process.env.PROKIP_API}/connector/api/opening-stock`,
        openingStockPayload,
        { headers: authHeaders, timeout: 15000 }
      );

      console.log(`   Opening Stock Status: ${openingResponse.status}`);
      
      if (openingResponse.status === 200) {
        console.log('   ✅ Stock added successfully');
        
        // Wait and check stock
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const updatedProducts = await prokipService.getProducts(config.locationId, config.userId);
        const updatedProduct = updatedProducts.find(p => p.sku === testProduct.sku);
        const newStock = parseInt(updatedProduct.stock || updatedProduct.qty_available || 0);
        
        console.log(`   Stock after adding: ${newStock}`);
        
        if (newStock > 0) {
          console.log('   🎉 Stock successfully added!');
          
          // 2. Test stock reduction using sell endpoint
          console.log('\n📋 2. Testing Stock Reduction Using Sell Endpoint');
          
          try {
            const sellPayload = {
              location_id: config.locationId,
              contact_id: 1, // Default contact
              transaction_date: new Date().toISOString(),
              invoice_no: `STOCK-REDUCE-${Date.now()}`,
              final_total: 100,
              sell_lines: [
                {
                  product_id: testProduct.id,
                  variation_id: testProduct.product_variations?.[0]?.id || null,
                  quantity: 3,
                  unit_price: 50,
                  line_total: 150
                }
              ]
            };

            console.log('   Reducing 3 units from stock...');
            
            const sellResponse = await axios.post(
              `${process.env.PROKIP_API}/connector/api/sell`,
              sellPayload,
              { headers: authHeaders, timeout: 15000 }
            );

            console.log(`   Sell Status: ${sellResponse.status}`);
            
            if (sellResponse.status === 200) {
              console.log('   ✅ Stock reduction successful');
              
              // Wait and check final stock
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              const finalProducts = await prokipService.getProducts(config.locationId, config.userId);
              const finalProduct = finalProducts.find(p => p.sku === testProduct.sku);
              const finalStock = parseInt(finalProduct.stock || finalProduct.qty_available || 0);
              
              console.log(`   Final Stock: ${finalStock}`);
              console.log(`   Stock Reduced: ${newStock - finalStock} units`);
              
              if (finalStock < newStock) {
                console.log('   🎉 STOCK REDUCTION ACTUALLY WORKS!');
                
                // 3. Update the prokipService to use this correct method
                console.log('\n📋 3. Updating Stock Reduction Method');
                
                await updateStockReductionMethod();
                
                console.log('\n🎯 COMPLETE SOLUTION IMPLEMENTED:');
                console.log('   ✅ Stock can be added using opening-stock endpoint');
                console.log('   ✅ Stock can be reduced using sell endpoint');
                console.log('   ✅ Real stock tracking is working');
                console.log('   ✅ Updated stock reduction method in prokipService');
                
                return;
              } else {
                console.log('   ❌ Stock reduction did not work');
              }
            }
          } catch (sellError) {
            console.log(`   ❌ Sell endpoint failed: ${sellError.message}`);
          }
        } else {
          console.log('   ❌ Stock was not added');
        }
      }
    } catch (openingError) {
      console.log(`   ❌ Opening stock failed: ${openingError.message}`);
    }

  } catch (error) {
    console.error('❌ Implementation failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function updateStockReductionMethod() {
  console.log('   Updating prokipService.js with correct stock reduction method...');
  
  const fs = require('fs');
  const path = require('path');
  
  const prokipServicePath = path.join(__dirname, 'src/services/prokipService.js');
  let content = fs.readFileSync(prokipServicePath, 'utf8');
  
  // Create a new stock reduction function that actually works
  const newStockReductionFunction = `
// WORKING STOCK REDUCTION - Uses sell endpoint to actually reduce stock
async function reduceStockActually(locationId, products, reason, userId) {
  try {
    const authHeaders = await getAuthHeaders(userId);
    const axios = require('axios');
    
    // Get product details
    const allProducts = await getProducts(locationId, userId);
    
    const sellLines = products.map(item => {
      const product = allProducts.find(p => p.sku === item.productId);
      if (!product) {
        throw new Error(\`Product SKU \${item.productId} not found in Prokip\`);
      }
      
      return {
        product_id: product.id,
        variation_id: product.product_variations?.[0]?.id || null,
        quantity: item.quantity,
        unit_price: parseFloat(item.unitPrice || 0),
        line_total: parseFloat(item.unitPrice || 0) * item.quantity
      };
    });
    
    const payload = {
      location_id: locationId,
      contact_id: 1, // Default contact
      transaction_date: new Date().toISOString(),
      invoice_no: \`WC-STOCK-\${Date.now()}\`,
      final_total: sellLines.reduce((sum, line) => sum + line.line_total, 0),
      sell_lines: sellLines
    };
    
    console.log('🔧 Reducing stock with sell payload:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post(
      \`\${process.env.PROKIP_API}/connector/api/sell\`,
      payload,
      { headers: authHeaders, timeout: 15000 }
    );
    
    if (response.status === 200) {
      console.log('✓ Stock actually reduced via sell endpoint');
      return { success: true, endpoint: '/connector/api/sell', response: response.data };
    } else {
      throw new Error(\`Sell endpoint returned status: \${response.status}\`);
    }
    
  } catch (error) {
    console.log('❌ Working stock reduction failed:', error.message);
    throw error;
  }
}
`;
  
  // Add the new function to the service file
  content += newStockReductionFunction;
  
  // Update the deductStockFromProkip function to use the working method
  content = content.replace(
    'async function deductStockFromProkip(products, locationId, reason, userId) {',
    'async function deductStockFromProkip_OLD(products, locationId, reason, userId) {'
  );
  
  // Add new deductStockFromProkip function
  const newDeductFunction = `
// NEW WORKING STOCK REDUCTION FUNCTION
async function deductStockFromProkip(products, locationId, reason, userId) {
  console.log('🔄 Using WORKING stock reduction method');
  
  try {
    // Use the working stock reduction method
    const result = await reduceStockActually(locationId, products, reason, userId);
    return result;
  } catch (error) {
    console.log('⚠️ Working stock reduction failed, trying fallback methods...');
    
    // Try the old methods as fallback
    return await deductStockFromProkip_OLD(products, locationId, reason, userId);
  }
}
`;
  
  content += newDeductFunction;
  
  fs.writeFileSync(prokipServicePath, content);
  console.log('   ✅ Stock reduction method updated in prokipService.js');
}

// Run the implementation
if (require.main === module) {
  implementCorrectStockReduction()
    .then(() => {
      console.log('\n✨ Correct stock reduction implementation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Implementation crashed:', error);
      process.exit(1);
    });
}

module.exports = { implementCorrectStockReduction };
