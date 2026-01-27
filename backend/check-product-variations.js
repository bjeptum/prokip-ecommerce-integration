const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function checkProductVariations() {
  try {
    console.log('🔍 Checking product variations for SKU 4922111...');
    
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });
    
    if (!prokipConfig?.token) {
      console.log('❌ No Prokip config found');
      return;
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };
    
    // Get product details for SKU 4922111
    const productsResponse = await axios.get('https://api.prokip.africa/connector/api/product?per_page=-1', { headers });
    const prokipProducts = productsResponse.data.data;
    
    const product = prokipProducts.find(p => p.sku === '4922111');
    if (!product) {
      console.log('❌ Product 4922111 not found');
      return;
    }
    
    console.log('📦 Product details:');
    console.log(JSON.stringify(product, null, 2));
    
    // Check if this product has variations
    if (product.variations && product.variations.length > 0) {
      console.log('\n🔄 Product variations:');
      product.variations.forEach((variation, index) => {
        console.log(`${index + 1}. Variation ID: ${variation.variation_id}, SKU: ${variation.sku || 'N/A'}`);
      });
    } else {
      console.log('\n❌ No variations found');
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkProductVariations();
