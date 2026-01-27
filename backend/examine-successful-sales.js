/**
 * Examine existing successful sales to understand the correct format
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

async function examineSuccessfulSales() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Examining existing successful sales...\n');

    // Get configurations
    const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId: 50 } });

    if (!prokipConfig) {
      console.error('❌ Missing Prokip config');
      return;
    }

    // Get Prokip headers
    const prokipHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };

    // Get recent sales with detailed product info
    console.log('📊 Fetching recent sales with product details...');
    try {
      const salesResponse = await axios.get('https://api.prokip.africa/connector/api/sell?per_page=10&status=final', { headers: prokipHeaders });
      const sales = salesResponse.data.data || salesResponse.data;
      
      if (sales && sales.length > 0) {
        console.log(`✅ Found ${sales.length} final status sales`);
        
        // Look for sales with products
        for (let i = 0; i < Math.min(3, sales.length); i++) {
          const sale = sales[i];
          console.log(`\n🔍 Sale ${i + 1}:`);
          console.log(`  ID: ${sale.id}`);
          console.log(`  Status: ${sale.status}`);
          console.log(`  Invoice: ${sale.invoice_no}`);
          console.log(`  Total: ${sale.final_total}`);
          
          if (sale.sell_lines || sale.products) {
            const products = sale.sell_lines || sale.products;
            console.log(`  Products (${products.length}):`);
            
            products.forEach((product, index) => {
              console.log(`    ${index + 1}. ${product.name || 'Unknown'}`);
              console.log(`       SKU: ${product.sku || 'N/A'}`);
              console.log(`       Quantity: ${product.quantity}`);
              console.log(`       Product ID: ${product.product_id}`);
              console.log(`       Variation ID: ${product.variation_id}`);
              console.log(`       Unit Price: ${product.unit_price || product.sell_price}`);
              
              // Check all fields
              console.log(`       All fields: ${Object.keys(product)}`);
            });
          }
        }
      } else {
        console.log('❌ No final status sales found');
        
        // Try to get any sales
        const allSalesResponse = await axios.get('https://api.prokip.africa/connector/api/sell?per_page=5', { headers: prokipHeaders });
        const allSales = allSalesResponse.data.data || allSalesResponse.data;
        
        if (allSales && allSales.length > 0) {
          console.log(`\n📊 Found ${allSales.length} sales with any status:`);
          allSales.forEach((sale, index) => {
            console.log(`  ${index + 1}. ID: ${sale.id}, Status: ${sale.status}, Has products: ${!!(sale.sell_lines || sale.products)}`);
          });
        }
      }
    } catch (error) {
      console.error('❌ Failed to fetch sales:', error.response?.data || error.message);
    }

    // Try to create a sale using the exact structure from an existing one
    console.log('\n🧪 Attempting to create sale using existing structure...');
    
    // Get a single product to work with
    const productResponse = await axios.get('https://api.prokip.africa/connector/api/product?per_page=1', { headers: prokipHeaders });
    const product = productResponse.data.data[0];
    
    if (product) {
      // Try the structure used in existing sales
      const existingStyleSale = {
        location_id: parseInt(prokipConfig.locationId),
        contact_id: 1849984,
        transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        invoice_no: `EXISTING-${Date.now()}`,
        status: 'final',
        type: 'sell',
        payment_status: 'paid',
        final_total: 100,
        sell_lines: [{  // Try sell_lines instead of products
          name: product.name,
          sku: product.sku,
          quantity: 1,
          unit_price: 100,
          sell_price: 100,
          product_id: product.id,
          variation_id: product.id  // Try product_id as variation_id
        }]
      };

      console.log('📝 Trying sell_lines structure...');
      try {
        const response = await axios.post('https://api.prokip.africa/connector/api/sell', existingStyleSale, { headers: prokipHeaders });
        
        if (response.data && response.data.length > 0 && !response.data[0].original?.error) {
          console.log('✅ SUCCESS! sell_lines structure worked');
          console.log('Response:', JSON.stringify(response.data, null, 2));
        } else {
          console.log('❌ sell_lines failed:', response.data[0]?.original?.error?.message);
        }
      } catch (error) {
        console.log('❌ sell_lines error:', error.response?.data?.[0]?.original?.error?.message);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

examineSuccessfulSales();
