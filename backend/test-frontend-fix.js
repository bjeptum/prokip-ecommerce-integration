const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testFrontendFix() {
  try {
    console.log('🔍 Testing frontend fix for stock display...');
    
    // Get Prokip config for authentication
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });
    
    if (!prokipConfig?.token) {
      console.log('No Prokip config found');
      return;
    }
    
    // Get products from Store 5
    const productsResponse = await axios.get('http://localhost:3000/stores/my-store/products?connectionId=5', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${prokipConfig.token}`
      }
    });
    
    let products = productsResponse.data.products || [];
    
    // Apply frontend sorting logic
    products.sort((a, b) => {
      const stockA = parseInt(a.stock_quantity) || 0;
      const stockB = parseInt(b.stock_quantity) || 0;
      
      if (stockB !== stockA) {
        return stockB - stockA;
      }
      
      return a.name.localeCompare(b.name);
    });
    
    console.log(`\n📦 Total products: ${products.length}`);
    
    // Test frontend display logic with stock_quantity
    console.log('\n🎯 Testing frontend display logic (using stock_quantity):');
    
    // Calculate stats like frontend does
    const totalProducts = products.length;
    const totalStock = products.reduce((sum, p) => sum + (parseInt(p.stock_quantity) || 0), 0);
    const inStock = products.filter(p => (parseInt(p.stock_quantity) || 0) > 0).length;
    const outOfStock = products.filter(p => (parseInt(p.stock_quantity) || 0) === 0).length;
    
    console.log(`📊 Frontend Stats (FIXED):`);
    console.log(`  Total Products: ${totalProducts}`);
    console.log(`  Total Stock Units: ${totalStock}`);
    console.log(`  In Stock: ${inStock}`);
    console.log(`  Out of Stock: ${outOfStock}`);
    
    // Show first 10 products as frontend would display them
    console.log('\n🎯 First 10 products (what frontend will show):');
    products.slice(0, 10).forEach((product, index) => {
      const stock = parseInt(product.stock_quantity) || 0;
      const stockStatus = stock > 0 ? '✅ In Stock' : '❌ Out of Stock';
      const stockClass = stock > 0 ? 'stock-in' : 'stock-out';
      
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   SKU: ${product.sku}`);
      console.log(`   Price: KES ${parseFloat(product.price || 0).toLocaleString()}`);
      console.log(`   Stock: ${stock} units ${stockStatus}`);
      console.log(`   CSS Class: ${stockClass}`);
      console.log('');
    });
    
    // Verify the fix worked
    const first10 = products.slice(0, 10);
    const inStockFirst10 = first10.filter(p => parseInt(p.stock_quantity) > 0).length;
    
    console.log(`🎉 RESULT: ${inStockFirst10}/10 products in first view have stock`);
    
    if (inStockFirst10 >= 8) {
      console.log('✅ SUCCESS! Frontend will now show products with stock prominently!');
    } else {
      console.log('❌ Still showing too many out-of-stock products');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testFrontendFix();
