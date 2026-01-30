const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');

const prisma = new PrismaClient();

async function testStockDeduction() {
  console.log('🧪 Testing Stock Deduction');
  console.log('==========================');

  try {
    // 1. Get current stock
    console.log('\n1️⃣ Getting current stock levels...');
    const currentStock = await prokipService.getInventory(null, 50);
    
    const testSkus = ['4848961', '4815445'];
    const initialStock = {};
    
    for (const sku of testSkus) {
      const stockItem = currentStock.find(item => item.sku === sku);
      initialStock[sku] = stockItem ? parseInt(stockItem.stock) : 0;
      console.log(`   SKU ${sku}: ${initialStock[sku]} units`);
    }

    // 2. Test stock deduction
    console.log('\n2️⃣ Testing stock deduction...');
    
    // Get product IDs
    const products = await prokipService.getProducts(null, 50);
    const productIds = {};
    
    for (const sku of testSkus) {
      const product = products.find(p => p.sku === sku);
      if (product) {
        productIds[sku] = product.id;
        console.log(`   SKU ${sku} -> Product ID: ${product.id}`);
      }
    }

    // Prepare products for deduction
    const productsForDeduction = testSkus.map(sku => ({
      productId: productIds[sku],
      quantity: 1
    })).filter(p => p.productId);

    if (productsForDeduction.length > 0) {
      console.log(`   Attempting to deduct stock for ${productsForDeduction.length} products...`);
      
      try {
        await prokipService.deductStockFromProkip(
          productsForDeduction,
          null, // Use default location
          'Test stock deduction',
          50
        );
        console.log('✅ Stock deduction successful!');
      } catch (error) {
        console.error('❌ Stock deduction failed:', error.message);
        console.log('   This might be due to API endpoint issues');
      }
    }

    // 3. Check stock after deduction
    console.log('\n3️⃣ Checking stock after deduction...');
    
    // Wait a moment for the adjustment to process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const newStock = await prokipService.getInventory(null, 50);
    
    for (const sku of testSkus) {
      const stockItem = newStock.find(item => item.sku === sku);
      const currentQty = stockItem ? parseInt(stockItem.stock) : 0;
      const change = currentQty - initialStock[sku];
      
      console.log(`   SKU ${sku}: ${initialStock[sku]} → ${currentQty} (${change > 0 ? '+' : ''}${change})`);
    }

    console.log('\n✅ Stock deduction test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run test
testStockDeduction();
