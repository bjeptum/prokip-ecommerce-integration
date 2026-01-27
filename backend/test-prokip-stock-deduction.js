const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testProkipStockDeduction() {
  try {
    console.log('🧪 Testing Prokip stock deduction methods...');
    
    // Get Prokip config
    const prokipConfig = await prisma.prokipConfig.findFirst();
    if (!prokipConfig) {
      console.error('❌ Prokip config not found');
      return;
    }
    
    const prokipHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };
    
    // Test product: Hair cream (SKU: 4848961)
    const testSku = '4848961';
    
    // Get product details
    console.log(`📦 Getting product details for SKU: ${testSku}`);
    const productsResponse = await axios.get(
      `https://api.prokip.africa/connector/api/product?per_page=-1`,
      { headers: prokipHeaders }
    );
    
    const product = productsResponse.data.data.find(p => p.sku === testSku);
    if (!product) {
      console.error(`❌ Product not found for SKU: ${testSku}`);
      return;
    }
    
    console.log(`✅ Found product: ${product.name} (ID: ${product.id})`);
    console.log(`📊 Product type: ${product.type}`);
    
    // Get current stock
    console.log('📊 Getting current stock...');
    const stockResponse = await axios.get(
      `https://api.prokip.africa/connector/api/product-stock-report?product_id=${product.id}`,
      { headers: prokipHeaders }
    );
    
    const currentStock = stockResponse.data?.[0]?.stock || stockResponse.data?.[0]?.qty_available || 0;
    console.log(`📊 Current stock: ${currentStock} units`);
    
    // Check product structure for variations
    console.log('🔍 Analyzing product structure...');
    console.log(`  - Has product_variations: ${!!product.product_variations}`);
    console.log(`  - Has variations: ${!!product.variations}`);
    
    if (product.product_variations && product.product_variations.length > 0) {
      console.log(`  - Product variations count: ${product.product_variations.length}`);
      product.product_variations.forEach((pv, i) => {
        console.log(`    Variation ${i}: ${pv.variations?.length || 0} variations`);
        if (pv.variations && pv.variations.length > 0) {
          pv.variations.forEach((v, j) => {
            console.log(`      - Variation ${j}: ID=${v.variation_id}, SKU=${v.sku}`);
          });
        }
      });
    }
    
    if (product.variations && product.variations.length > 0) {
      console.log(`  - Direct variations count: ${product.variations.length}`);
      product.variations.forEach((v, i) => {
        console.log(`    - Variation ${i}: ID=${v.variation_id}, SKU=${v.sku}`);
      });
    }
    
    // Test different stock deduction methods
    console.log('\n🧪 Testing stock deduction methods...');
    
    // Method 1: Try to create a sale transaction (this should deduct stock)
    console.log('📝 Method 1: Creating sale transaction...');
    try {
      const saleData = {
        location_id: prokipConfig.locationId,
        contact: {
          name: 'Test Customer',
          email: 'test@example.com'
        },
        products: [{
          product_id: product.id,
          sku: testSku,
          quantity: 1,
          unit_price: 100,
          total_price: 100
        }],
        payment_method: 'cash',
        final_total: 100,
        transaction_date: new Date().toISOString()
      };
      
      const saleResponse = await axios.post(
        'https://api.prokip.africa/connector/api/sell',
        saleData,
        { headers: prokipHeaders }
      );
      
      console.log('✅ Sale transaction created successfully');
      console.log(`  Sale ID: ${saleResponse.data.id}`);
      
      // Check stock after sale
      setTimeout(async () => {
        try {
          const newStockResponse = await axios.get(
            `https://api.prokip.africa/connector/api/product-stock-report?product_id=${product.id}`,
            { headers: prokipHeaders }
          );
          
          const newStock = newStockResponse.data?.[0]?.stock || newStockResponse.data?.[0]?.qty_available || 0;
          console.log(`📊 Stock after sale: ${newStock} units (was ${currentStock})`);
          console.log(`📉 Stock deducted: ${currentStock - newStock} units`);
        } catch (error) {
          console.log(`❌ Error checking stock after sale: ${error.message}`);
        }
      }, 2000);
      
    } catch (error) {
      console.log(`❌ Method 1 failed: ${error.message}`);
      if (error.response) {
        console.log(`  Status: ${error.response.status}`);
        console.log(`  Data:`, error.response.data);
      }
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Data:`, error.response.data);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testProkipStockDeduction();
