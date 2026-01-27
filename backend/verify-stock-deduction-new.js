const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function verifyStockDeduction() {
  try {
    console.log('🔍 Verifying stock deduction in Prokip...');
    
    // Get Prokip config
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { userId: 50 }
    });
    
    if (!prokipConfig?.token) {
      console.log('❌ Prokip config not found');
      return;
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };
    
    // Check product 4922111 stock
    console.log('📦 Checking stock for product 4922111...');
    
    const stockResponse = await axios.get(`https://api.prokip.africa/connector/api/product-stock-report?location_id=${prokipConfig.locationId}`, { headers });
    const stockData = Array.isArray(stockResponse.data) ? stockResponse.data : (stockResponse.data.data || []);
    
    const productStock = stockData.find(item => item.sku === '4922111');
    
    if (productStock) {
      console.log(`📊 Current stock for SKU 4922111: ${productStock.stock || productStock.qty_available || 0}`);
      console.log(`📦 Product name: ${productStock.product_name || productStock.name}`);
    } else {
      console.log('❌ Product 4922111 not found in stock report');
    }
    
    // Check recent sales to confirm our sale
    console.log('\n🔍 Checking recent sales...');
    const salesResponse = await axios.get(`https://api.prokip.africa/connector/api/sell?location_id=${prokipConfig.locationId}&per_page=5`, { headers });
    const salesData = salesResponse.data.data || salesResponse.data;
    
    console.log(`📊 Found ${salesData.length} recent sales:`);
    salesData.slice(0, 3).forEach((sale, index) => {
      console.log(`${index + 1}. Sale ID: ${sale.id} - Invoice: ${sale.invoice_no} - Total: ${sale.final_total} - Date: ${sale.transaction_date}`);
    });
    
    // Check our specific sale
    const ourSale = salesData.find(sale => sale.invoice_no === 'WC-14148');
    if (ourSale) {
      console.log('\n✅ Our sale found in Prokip!');
      console.log(`📊 Sale ID: ${ourSale.id}`);
      console.log(`📊 Invoice: ${ourSale.invoice_no}`);
      console.log(`📊 Total: ${ourSale.final_total}`);
      console.log(`📊 Status: ${ourSale.status}`);
      
      if (ourSale.sell_lines) {
        ourSale.sell_lines.forEach(line => {
          console.log(`📦 Product: ${line.product_id} - Variation: ${line.variation_id} - Qty: ${line.quantity}`);
        });
      }
    } else {
      console.log('\n❌ Our sale not found in recent sales');
    }
    
    // Check sales log in our database
    console.log('\n🗃️ Checking our sales log...');
    const salesLog = await prisma.salesLog.findMany({
      where: { orderId: '14148' }
    });
    
    console.log(`📊 Found ${salesLog.length} sales log entries for order 14148:`);
    salesLog.forEach(log => {
      console.log(`- ID: ${log.id} - Status: ${log.status} - Amount: ${log.totalAmount} - Created: ${log.createdAt}`);
    });
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  } finally {
    await prisma.$disconnect();
  }
}

verifyStockDeduction();
