const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function checkRecentProkipSales() {
  try {
    console.log('🔍 Checking recent Prokip sales...');
    
    // Get Prokip config
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
    
    // Try different sales endpoints
    const endpoints = [
      'https://api.prokip.africa/connector/api/sales?per_page=50',
      'https://api.prokip.africa/connector/api/transactions?per_page=50',
      'https://api.prokip.africa/connector/api/sell?per_page=50'
    ];
    
    for (const endpoint of endpoints) {
      console.log(`\n🔍 Checking endpoint: ${endpoint}`);
      
      try {
        const response = await axios.get(endpoint, { headers });
        const data = response.data;
        
        console.log(`✅ SUCCESS! Found ${Array.isArray(data) ? data.length : 'object with data array'} items`);
        
        console.log('🔍 Response type:', typeof data);
        console.log('🔍 Response keys:', Object.keys(data || {}));
        
        // The actual data is in data.data array
        const salesData = data.data || [];
        console.log(`📊 Found ${salesData.length} sales in data.data array`);
        
        if (salesData.length > 0) {
          console.log('\n📊 Recent transactions:');
          salesData.slice(0, 20).forEach((item, index) => {
            const refNumber = item.invoice_no || item.reference_number || 'N/A';
            const createdDate = item.created_at || 'N/A';
            
            console.log(`${index + 1}. ID: ${item.id} - Amount: ${item.final_total || item.total_amount || 'N/A'} - Ref: ${refNumber} - Date: ${createdDate} - Status: ${item.status || 'N/A'}`);
            
            // Check if this matches our order
            if (refNumber.toString().includes('14148')) {
              console.log(`   🎯 FOUND OUR ORDER #14148!`);
            }
            
            // Check for today's sales (January 22, 2026)
            if (createdDate.includes('2026-01-22')) {
              console.log(`   📅 TODAY'S SALE!`);
            }
          });
          
          // Look for any sales from today
          const todaySales = salesData.filter(item => {
            const createdDate = item.created_at || '';
            return createdDate.includes('2026-01-22');
          });
          
          console.log(`\n📅 Today's sales (2026-01-22): ${todaySales.length}`);
          if (todaySales.length > 0) {
            todaySales.forEach((sale, index) => {
              console.log(`   ${index + 1}. ID: ${sale.id} - Ref: ${sale.invoice_no || 'N/A'} - Amount: ${sale.final_total || 'N/A'} - Status: ${sale.status || 'N/A'}`);
            });
          }
        }
        
        break; // Stop at first successful endpoint
      } catch (error) {
        console.log(`❌ Failed: ${error.response?.status} - ${error.response?.statusText}`);
      }
    }
    
    // Also check inventory to see if stock changed
    console.log('\n🔍 Checking current inventory...');
    try {
      const inventoryResponse = await axios.get('https://api.prokip.africa/connector/api/product-stock-report', { headers });
      const inventory = inventoryResponse.data;
      
      if (Array.isArray(inventory)) {
        // Find the product from our order
        const product = inventory.find(p => p.sku === '4922111'); // This was in our order
        if (product) {
          console.log(`📦 Product SKU 4922111: ${product.stock_quantity} units in stock`);
        }
      }
    } catch (error) {
      console.log('❌ Could not check inventory:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecentProkipSales();
