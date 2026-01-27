const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function checkProductOrdering() {
  try {
    console.log('🔍 Checking product ordering and stock distribution...');
    
    // Get Prokip config for authentication
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });
    
    if (!prokipConfig?.token) {
      console.log('No Prokip config found');
      return;
    }
    
    // Get current products from Store 5
    const productsResponse = await axios.get('http://localhost:3000/stores/my-store/products?connectionId=5', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${prokipConfig.token}`
      }
    });
    
    const products = productsResponse.data.products || [];
    console.log(`\n📦 Total products: ${products.length}`);
    
    // Separate products by stock level
    const inStock = products.filter(p => parseInt(p.stock_quantity) > 0);
    const outOfStock = products.filter(p => parseInt(p.stock_quantity) === 0);
    
    console.log(`✅ In stock (>0): ${inStock.length} products`);
    console.log(`❌ Out of stock (0): ${outOfStock.length} products`);
    
    // Show first 10 products with stock
    console.log('\n🎯 First 10 products WITH stock:');
    inStock.slice(0, 10).forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} (SKU: ${product.sku}) - Stock: ${product.stock_quantity}`);
    });
    
    // Show first 10 products without stock  
    console.log('\n❌ First 10 products WITHOUT stock:');
    outOfStock.slice(0, 10).forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} (SKU: ${product.sku}) - Stock: ${product.stock_quantity}`);
    });
    
    // Check if frontend is showing products in a specific order
    console.log('\n🔍 Analyzing frontend display order...');
    console.log('First 20 products as shown by default:');
    products.slice(0, 20).forEach((product, index) => {
      const stockStatus = parseInt(product.stock_quantity) > 0 ? '✅' : '❌';
      console.log(`${(index + 1).toString().padStart(2)}. ${stockStatus} ${product.name} (Stock: ${product.stock_quantity})`);
    });
    
    // Suggest solution: sort by stock level
    console.log('\n💡 SUGGESTION: Products should be sorted by stock level');
    console.log('Currently showing out-of-stock products first, which looks like an issue');
    
  } catch (error) {
    console.error('❌ Check failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkProductOrdering();
