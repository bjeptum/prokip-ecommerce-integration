/**
 * DIRECT PROKIP STOCK DEDUCTION
 * 
 * This function directly deducts stock from Prokip using the correct API endpoint
 */

const axios = require('axios');
const prisma = require('../lib/prisma');

/**
 * Deduct stock directly from Prokip using the sell endpoint
 * This is the most reliable method for stock deduction
 */
async function deductStockDirectlyFromProkip(products, locationId, reason, userId) {
  try {
    // Get Prokip config
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId }
    });

    if (!prokipConfig?.token || !prokipConfig.locationId) {
      throw new Error('Prokip not configured');
    }

    console.log(`🔧 Direct stock deduction for ${products.length} products`);
    console.log(`📍 Location ID: ${locationId || prokipConfig.locationId}`);

    // Get current Prokip products to ensure we have correct product IDs
    const productsResponse = await axios.get('https://api.prokip.africa/connector/api/product?per_page=-1', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${prokipConfig.token}`,
        Accept: 'application/json'
      }
    });
    const prokipProducts = productsResponse.data.data;

    const results = [];

    for (const item of products) {
      try {
        // Find the product in Prokip
        const prokipProduct = prokipProducts.find(p => p.sku === item.sku || p.id === item.productId);
        
        if (!prokipProduct) {
          console.log(`❌ Product not found: SKU ${item.sku}, Product ID ${item.productId}`);
          results.push({
            sku: item.sku,
            success: false,
            error: 'Product not found in Prokip'
          });
          continue;
        }

        // Create a stock adjustment sale (this is how Prokip handles stock reduction)
        const stockAdjustmentBody = {
          sells: [{
            location_id: parseInt(locationId || prokipConfig.locationId),
            contact_id: 1849984, // Use existing contact ID
            transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
            invoice_no: `STOCK-ADJ-${Date.now()}-${item.sku}`,
            status: 'final',
            type: 'sell',
            payment_status: 'paid',
            final_total: 0, // Stock adjustments have no monetary value
            discount_amount: 0,
            discount_type: 'fixed',
            products: [{
              product_id: prokipProduct.id,
              variation_id: prokipProduct.variation_id || prokipProduct.id,
              quantity: parseInt(item.quantity),
              unit_price: 0,
              total_price: 0
            }],
            payments: [{
              method: 'stock_adjustment',
              amount: 0,
              paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
            }]
          }]
        };

        console.log(`📝 Stock adjustment for ${item.sku}:`, JSON.stringify(stockAdjustmentBody, null, 2));

        // Make the API call
        const response = await axios.post('https://api.prokip.africa/connector/api/sell', stockAdjustmentBody, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${prokipConfig.token}`,
            Accept: 'application/json'
          },
          timeout: 15000
        });

        if (response.data && !response.data.error) {
          console.log(`✅ Stock deducted for ${item.sku}: ${item.quantity} units`);
          results.push({
            sku: item.sku,
            productId: prokipProduct.id,
            quantity: item.quantity,
            success: true,
            response: response.data
          });
        } else {
          throw new Error('Stock adjustment failed');
        }

      } catch (error) {
        console.error(`❌ Failed to deduct stock for ${item.sku}:`, error.message);
        results.push({
          sku: item.sku,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`🎉 Stock deduction completed: ${successCount}/${products.length} successful`);

    return {
      success: successCount > 0,
      totalProducts: products.length,
      successful: successCount,
      failed: products.length - successCount,
      results: results
    };

  } catch (error) {
    console.error('Direct stock deduction failed:', error);
    throw error;
  }
}

module.exports = {
  deductStockDirectlyFromProkip
};
