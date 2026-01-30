const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');

const prisma = new PrismaClient();

async function investigateProkipStockManagement() {
  console.log('🔍 Investigating Prokip Stock Management');
  console.log('==========================================');

  try {
    // 1. Check product details to see if there are stock-related fields
    console.log('\n1️⃣ Checking product details...');
    const products = await prokipService.getProducts(null, 50);
    
    const testProduct = products.find(p => p.sku === '4848961');
    if (testProduct) {
      console.log('✅ Found test product:');
      console.log('   Product structure:', JSON.stringify(testProduct, null, 2));
      
      // Check if there are stock-related fields
      const stockFields = Object.keys(testProduct).filter(key => 
        key.toLowerCase().includes('stock') || 
        key.toLowerCase().includes('quantity') || 
        key.toLowerCase().includes('inventory')
      );
      
      if (stockFields.length > 0) {
        console.log('   Stock-related fields:', stockFields);
      } else {
        console.log('   No obvious stock-related fields found');
      }
    }

    // 2. Check if there's a dedicated inventory endpoint
    console.log('\n2️⃣ Testing inventory management endpoints...');
    
    const headers = await prokipService.getAuthHeaders(50);
    const axios = require('axios');
    
    // Try different inventory endpoints
    const inventoryEndpoints = [
      '/connector/api/inventory',
      '/connector/api/inventory/4848961',
      '/connector/api/product/4848961/inventory',
      '/connector/api/location/21237/inventory',
      '/connector/api/stock'
    ];

    for (const endpoint of inventoryEndpoints) {
      try {
        const response = await axios.get(
          `https://api.prokip.africa${endpoint}`,
          { headers, timeout: 5000 }
        );
        console.log(`✅ GET ${endpoint} - SUCCESS`);
        console.log(`   Data keys:`, Object.keys(response.data));
      } catch (error) {
        if (error.response?.status === 404) {
          console.log(`❌ GET ${endpoint} - Not Found`);
        } else {
          console.log(`⚠️  GET ${endpoint} - ${error.response?.status}`);
        }
      }
    }

    // 3. Try to update product stock directly
    console.log('\n3️⃣ Testing direct stock update...');
    
    try {
      // Try PATCH method
      const response = await axios.patch(
        'https://api.prokip.africa/connector/api/product/4848961',
        {
          stock: 69,
          quantity: 69,
          inventory_quantity: 69
        },
        { headers, timeout: 5000 }
      );
      console.log('✅ PATCH product stock - SUCCESS');
      console.log('   Response:', response.data);
    } catch (error) {
      console.log('❌ PATCH product stock - FAILED');
      console.log(`   Error:`, error.response?.data || error.message);
    }

    // 4. Check if there's a stock transaction endpoint
    console.log('\n4️⃣ Testing stock transaction endpoints...');
    
    const transactionEndpoints = [
      '/connector/api/stock-transactions',
      '/connector/api/inventory-transactions',
      '/connector/api/stock-movements'
    ];

    for (const endpoint of transactionEndpoints) {
      try {
        const transactionPayload = {
          product_id: 4848961,
          quantity: -1,
          transaction_type: 'sale',
          location_id: 21237,
          date: '2026-01-28'
        };

        const response = await axios.post(
          `https://api.prokip.africa${endpoint}`,
          transactionPayload,
          { headers, timeout: 5000 }
        );
        console.log(`✅ POST ${endpoint} - SUCCESS`);
        console.log('   Response:', response.data);
        break;
      } catch (error) {
        if (error.response?.status === 404) {
          console.log(`❌ POST ${endpoint} - Not Found`);
        } else {
          console.log(`⚠️  POST ${endpoint} - ${error.response?.status}`);
          console.log(`   Error:`, error.response?.data || error.message);
        }
      }
    }

    // 5. Check current stock again to see if anything changed
    console.log('\n5️⃣ Final stock check...');
    const finalStock = await prokipService.getInventory(null, 50);
    const finalStockItem = finalStock.find(item => item.sku === '4848961');
    console.log(`   SKU 4848961: ${finalStockItem ? finalStockItem.stock : 'Not found'} units`);

    console.log('\n✅ Investigation completed!');

  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run investigation
investigateProkipStockManagement();
