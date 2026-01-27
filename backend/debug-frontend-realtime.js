const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function debugFrontendRealtime() {
  try {
    console.log('🔍 Debugging frontend real-time behavior...');
    
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
    
    console.log('\n🔄 Step 1: Force inventory sync (like frontend does)...');
    const syncResponse = await axios.post('http://localhost:3000/sync/inventory', {
      connectionId: 5
    }, {
      headers
    });
    
    console.log(`Sync response: ${syncResponse.data.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Results: ${syncResponse.data.results?.length || 0} items`);
    
    // Show any errors in sync
    const errors = syncResponse.data.results?.filter(r => r.status === 'error') || [];
    if (errors.length > 0) {
      console.log('\n❌ Sync errors:');
      errors.forEach((error, index) => {
        console.log(`${index + 1}. SKU ${error.sku}: ${error.error}`);
      });
    }
    
    console.log('\n📦 Step 2: Get products immediately after sync...');
    const productsResponse = await axios.get('http://localhost:3000/stores/my-store/products?connectionId=5', {
      headers
    });
    
    const products = productsResponse.data.products || [];
    console.log(`Found ${products.length} products`);
    
    // Check first 10 products that should have stock
    const expectedStock = {
      '4848961': 76,  // Hair cream
      '4987009': 60,  // Martel Glue
      '4922111': 50,  // Marida Foundation
      '4846757': 45,  // Sampoo oil
      '4815445': 40,  // Claire Wash
      '4906797': 40,  // Lingerie
      '4922924': 22,  // Zana Scrubber
      '4874349': 18,  // always
      '4744942': 15,  // Shalsa Bead Necklace
      '4846767': 10   // Sunlit Soap
    };
    
    console.log('\n🎯 Checking products that SHOULD have stock:');
    let correctCount = 0;
    let incorrectCount = 0;
    
    for (const [sku, expectedQty] of Object.entries(expectedStock)) {
      const product = products.find(p => p.sku === sku);
      if (product) {
        const actualQty = parseInt(product.stock_quantity) || 0;
        const isCorrect = actualQty === expectedQty;
        
        console.log(`${sku} (${product.name}): ${actualQty} (expected: ${expectedQty}) ${isCorrect ? '✅' : '❌'}`);
        
        if (isCorrect) {
          correctCount++;
        } else {
          incorrectCount++;
        }
      } else {
        console.log(`${sku}: NOT FOUND ❌`);
        incorrectCount++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`✅ Correct stock: ${correctCount}`);
    console.log(`❌ Incorrect stock: ${incorrectCount}`);
    
    if (correctCount === Object.keys(expectedStock).length) {
      console.log(`🎉 All products have CORRECT stock!`);
      console.log(`💡 Issue might be frontend caching or display logic`);
    } else {
      console.log(`⚠️ Backend has incorrect stock data`);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugFrontendRealtime();
