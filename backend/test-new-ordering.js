const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testNewOrdering() {
  try {
    console.log('🔄 Testing new product ordering with in-stock items first...');
    
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
    
    // Apply the same sorting logic as frontend
    products.sort((a, b) => {
      const stockA = parseInt(a.stock_quantity) || 0;
      const stockB = parseInt(b.stock_quantity) || 0;
      
      // Sort by stock (descending), so items with stock appear first
      if (stockB !== stockA) {
        return stockB - stockA;
      }
      
      // If stock is same, sort by name alphabetically
      return a.name.localeCompare(b.name);
    });
    
    console.log(`\n📦 Total products: ${products.length}`);
    
    // Show first 20 products with new ordering
    console.log('\n🎯 First 20 products (NEW ORDERING - in-stock first):');
    products.slice(0, 20).forEach((product, index) => {
      const stockStatus = parseInt(product.stock_quantity) > 0 ? '✅' : '❌';
      const stockDisplay = parseInt(product.stock_quantity) > 0 ? product.stock_quantity : '0';
      console.log(`${(index + 1).toString().padStart(2)}. ${stockStatus} ${product.name} (Stock: ${stockDisplay})`);
    });
    
    // Count in-stock vs out-of-stock in first 10
    const first10 = products.slice(0, 10);
    const inStockFirst10 = first10.filter(p => parseInt(p.stock_quantity) > 0).length;
    const outOfStockFirst10 = first10.filter(p => parseInt(p.stock_quantity) === 0).length;
    
    console.log(`\n📊 First 10 products breakdown:`);
    console.log(`✅ In stock: ${inStockFirst10}`);
    console.log(`❌ Out of stock: ${outOfStockFirst10}`);
    
    if (inStockFirst10 > outOfStockFirst10) {
      console.log(`🎉 SUCCESS! Frontend will now show in-stock products first!`);
    } else {
      console.log(`⚠️ Still showing more out-of-stock products in first 10`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testNewOrdering();
