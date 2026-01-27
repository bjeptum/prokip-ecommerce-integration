const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function debugFrontendFlow() {
  try {
    console.log('🔄 Debugging complete frontend flow...');
    
    // Get Prokip config for authentication
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });
    
    if (!prokipConfig?.token) {
      console.log('No Prokip config found');
      return;
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`
    };
    
    // Step 1: Get current products (what frontend sees)
    console.log('\n📦 Step 1: Get current products from Store 5...');
    const productsResponse = await axios.get('http://localhost:3000/stores/my-store/products?connectionId=5', {
      headers
    });
    
    const products = productsResponse.data.products || [];
    console.log(`Found ${products.length} products`);
    
    // Show first 5 products with their stock
    console.log('\n📊 First 5 products (what frontend sees):');
    for (let i = 0; i < Math.min(5, products.length); i++) {
      const product = products[i];
      console.log(`${i + 1}. ${product.name} (SKU: ${product.sku})`);
      console.log(`   Stock: ${product.stock_quantity}`);
      console.log(`   Status: ${product.stock_status}`);
    }
    
    // Step 2: Trigger inventory sync (what frontend does)
    console.log('\n🔄 Step 2: Trigger inventory sync...');
    const syncResponse = await axios.post('http://localhost:3000/sync/inventory', {
      connectionId: 5
    }, {
      headers
    });
    
    console.log(`Sync result: ${syncResponse.data.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Synced: ${syncResponse.data.results?.filter(r => r.status === 'success').length || 0} products`);
    
    // Step 3: Wait a moment and get products again
    console.log('\n⏱️ Step 3: Wait 2 seconds and get products again...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const productsAfterSync = await axios.get('http://localhost:3000/stores/my-store/products?connectionId=5', {
      headers
    });
    
    const productsAfter = productsAfterSync.data.products || [];
    console.log(`Found ${productsAfter.length} products after sync`);
    
    // Compare first 5 products
    console.log('\n📊 First 5 products after sync:');
    for (let i = 0; i < Math.min(5, productsAfter.length); i++) {
      const product = productsAfter[i];
      console.log(`${i + 1}. ${product.name} (SKU: ${product.sku})`);
      console.log(`   Stock: ${product.stock_quantity}`);
      console.log(`   Status: ${product.stock_status}`);
      
      // Compare with before
      const beforeProduct = products[i];
      if (beforeProduct && beforeProduct.sku === product.sku) {
        if (beforeProduct.stock_quantity !== product.stock_quantity) {
          console.log(`   🔄 CHANGED: ${beforeProduct.stock_quantity} → ${product.stock_quantity}`);
        } else {
          console.log(`   ✅ SAME: ${product.stock_quantity}`);
        }
      }
    }
    
    // Check specific products that should have stock
    console.log('\n🎯 Checking specific products that should have stock:');
    const expectedStock = {
      '4744942': 15,  // Shalsa Bead Necklace
      '4815445': 40,  // Claire Wash
      '4848961': 76   // Hair cream
    };
    
    for (const [sku, expectedQty] of Object.entries(expectedStock)) {
      const product = productsAfter.find(p => p.sku === sku);
      if (product) {
        console.log(`${sku} (${product.name}): ${product.stock_quantity} (expected: ${expectedQty})`);
        if (parseInt(product.stock_quantity) === expectedQty) {
          console.log(`  ✅ CORRECT`);
        } else {
          console.log(`  ❌ MISMATCH`);
        }
      } else {
        console.log(`${sku}: NOT FOUND`);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugFrontendFlow();
