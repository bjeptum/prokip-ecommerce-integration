/**
 * Debug Prokip product structure to understand variation_id issue
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

async function debugProkipProducts() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Debugging Prokip product structure...\n');

    // Get Prokip config
    const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId: 50 } });
    if (!prokipConfig?.token) {
      console.error('❌ No Prokip config found');
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };

    // Get products
    const productsResponse = await axios.get('https://api.prokip.africa/connector/api/product?per_page=10', { headers });
    const products = productsResponse.data.data || [];
    
    console.log(`📦 Found ${products.length} products`);
    
    if (products.length > 0) {
      console.log('\n🔍 First product structure:');
      const firstProduct = products[0];
      console.log('Product keys:', Object.keys(firstProduct));
      console.log('Product details:', JSON.stringify(firstProduct, null, 2));
      
      // Check for variations
      if (firstProduct.variations) {
        console.log('\n🔍 Variations found:');
        console.log('Variations structure:', JSON.stringify(firstProduct.variations, null, 2));
      } else {
        console.log('\n❌ No variations found in product');
      }
      
      // Check product type
      console.log(`\n📋 Product type: ${firstProduct.type}`);
      console.log(`📋 Product ID: ${firstProduct.id}`);
      console.log(`📋 SKU: ${firstProduct.sku}`);
      
      // Try to find variation_id in different possible locations
      console.log('\n🔍 Looking for variation_id in various locations:');
      console.log(`- Direct variation_id: ${firstProduct.variation_id}`);
      console.log(`- In variations[0]: ${firstProduct.variations?.[0]?.variation_id}`);
      console.log(`- In product_variations: ${firstProduct.product_variations?.[0]?.variation_id}`);
      
      // Check if there are any variation-related fields
      const variationFields = Object.keys(firstProduct).filter(key => key.toLowerCase().includes('variation'));
      console.log(`- Variation-related fields: ${variationFields}`);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugProkipProducts();
