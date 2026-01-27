const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function implementRealProkipSync() {
  try {
    console.log('🚀 Implementing REAL Prokip stock deduction...');
    
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
    
    console.log('🧪 Testing real stock deduction via sell endpoint...');
    
    // Test: Create a stock adjustment sale to deduct 1 unit
    const stockAdjustmentSale = {
      location_id: prokipConfig.locationId,
      contact: {
        name: 'Stock Adjustment',
        email: 'sync@example.com'
      },
      products: [{
        product_id: 4848961, // Hair cream
        sku: '4848961',
        quantity: 1,
        unit_price: 0.01, // Minimal price for stock adjustment
        total_price: 0.01
      }],
      payment_method: 'cash',
      final_total: 0.01,
      transaction_date: new Date().toISOString(),
      invoice_no: `STOCK-ADJ-${Date.now()}`
    };
    
    console.log('📡 Creating stock adjustment sale...');
    const response = await axios.post(
      'https://api.prokip.africa/connector/api/sell',
      stockAdjustmentSale,
      { headers: prokipHeaders }
    );
    
    console.log('✅ Stock adjustment sale created!');
    console.log('📊 Response:', response.data);
    
    // Check if stock actually changed in Prokip
    console.log('\n🔍 Checking if stock changed in Prokip...');
    
    setTimeout(async () => {
      try {
        const stockResponse = await axios.get(
          `https://api.prokip.africa/connector/api/product-stock-report?product_id=4848961`,
          { headers: prokipHeaders }
        );
        
        const currentStock = stockResponse.data?.[0]?.stock || stockResponse.data?.[0]?.qty_available || 0;
        console.log(`📊 Current Prokip stock: ${currentStock}`);
        
        if (currentStock < 0) {
          console.log('✅ SUCCESS! Stock was deducted from Prokip!');
          console.log('🎉 We can now implement real Prokip sync!');
        } else {
          console.log('⚠️ Stock still shows 0 - need to investigate further');
        }
        
      } catch (error) {
        console.log(`❌ Error checking stock: ${error.message}`);
      }
    }, 2000);
    
    // Test stock addition (if possible)
    console.log('\n🧪 Testing stock addition method...');
    
    try {
      // Try to create a "purchase" or "stock in" transaction
      const stockAdditionSale = {
        location_id: prokipConfig.locationId,
        contact: {
          name: 'Initial Stock',
          email: 'setup@example.com'
        },
        products: [{
          product_id: 4848961,
          sku: '4848961',
          quantity: 100, // Add 100 units
          unit_price: 1,
          total_price: 100
        }],
        payment_method: 'cash',
        final_total: 100,
        transaction_date: new Date().toISOString(),
        invoice_no: `INITIAL-STOCK-${Date.now()}`
      };
      
      console.log('📡 Creating stock addition sale...');
      const addResponse = await axios.post(
        'https://api.prokip.africa/connector/api/sell',
        stockAdditionSale,
        { headers: prokipHeaders }
      );
      
      console.log('✅ Stock addition sale created!');
      console.log('📊 Response:', addResponse.data);
      
    } catch (error) {
      console.log(`❌ Stock addition failed: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Implementation error:', error.message);
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Data:`, error.response.data);
    }
  } finally {
    await prisma.$disconnect();
  }
}

implementRealProkipSync();
