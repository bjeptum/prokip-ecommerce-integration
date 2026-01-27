const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function findValidContact() {
  try {
    console.log('🔍 Finding valid contact IDs in Prokip...');
    
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
    
    // Get existing sales to see what contact IDs are being used
    console.log('\n📊 Checking existing sales for contact IDs...');
    try {
      const salesResponse = await axios.get('https://api.prokip.africa/connector/api/sell?per_page=50', { headers });
      const salesData = salesResponse.data.data || [];
      
      console.log(`Found ${salesData.length} existing sales:`);
      
      const contactIds = new Set();
      salesData.forEach((sale, index) => {
        console.log(`${index + 1}. Sale ID: ${sale.id} - Contact ID: ${sale.contact_id} - Customer: ${sale.contact_name || 'N/A'}`);
        if (sale.contact_id) {
          contactIds.add(sale.contact_id);
        }
      });
      
      console.log(`\n👥 Unique contact IDs found: ${Array.from(contactIds).join(', ')}`);
      
      // Try to create a sale with the first valid contact ID
      if (contactIds.size > 0) {
        const validContactId = Array.from(contactIds)[0];
        console.log(`\n✅ Using contact ID: ${validContactId}`);
        
        // Get product info from Prokip first to get correct variation_id
        console.log('🔍 Getting product info from Prokip...');
        const productsResponse = await axios.get('https://api.prokip.africa/connector/api/product?per_page=-1', { headers });
        const prokipProducts = productsResponse.data.data;
        
        const sellProducts = [];
        let finalTotal = 0;
        
        const products = [
          {
            sku: '4922111', // Use actual SKU from order
            quantity: '1',
            unitPrice: '100.00'
          }
        ];
        
        for (const item of products) {
          if (!item.sku) continue;
          
          const prokipProduct = prokipProducts.find(p => p.sku === item.sku);
          if (!prokipProduct) {
            console.log(`❌ Product with SKU ${item.sku} not found in Prokip`);
            continue;
          }
          
          console.log(`📦 Product ${item.sku}:`, {
            id: prokipProduct.id,
            name: prokipProduct.name,
            type: prokipProduct.type,
            hasVariations: !!(prokipProduct.variations && prokipProduct.variations.length > 0)
          });
          
          const quantity = parseInt(item.quantity);
          const unitPrice = parseFloat(item.unitPrice);
          const subtotal = quantity * unitPrice;
          finalTotal += subtotal;
          
          // Handle variation_id correctly - use actual variation ID if exists
          let variationId = prokipProduct.id; // Default to product ID
          if (prokipProduct.variations && prokipProduct.variations.length > 0) {
            // Use the first variation's variation_id
            const firstVariation = prokipProduct.variations[0];
            if (firstVariation && firstVariation.variation_id) {
              variationId = firstVariation.variation_id;
              console.log(`🔄 Using variation ID: ${variationId} for product ${item.sku}`);
            }
          } else if (prokipProduct.type === 'single') {
            // For single products, try using the variation ID from existing data
            variationId = 5291257; // From existing variation data
            console.log(`🔄 Using existing variation ID: ${variationId} for single product ${item.sku}`);
          }
          
          sellProducts.push({
            product_id: prokipProduct.id,
            variation_id: variationId,
            quantity,
            unit_price: unitPrice,
            unit_price_inc_tax: unitPrice
          });
          console.log(`🔍 Debug: product_id=${prokipProduct.id}, variation_id=${variationId}, sku=${item.sku}`);
        }
        
        // Test with this contact ID
        const testSellBody = {
          sells: [{
            location_id: parseInt(prokipConfig.locationId),
            contact_id: validContactId,
            transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
            invoice_no: `TEST-${Date.now()}`,
            status: 'final',
            type: 'sell',
            payment_status: 'paid',
            final_total: finalTotal,
            products: sellProducts,
            products: [{
              product_id: 4922111,
              variation_id: "4922111", // Try as string instead of integer
              quantity: 1,
              unit_price: 100,
              unit_price_inc_tax: 100
            }],
            payments: [{
              method: 'cash',
              amount: 100,
              paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
            }]
          }]
        };
        
        console.log('\n🧪 Testing with valid contact ID...');
        const response = await axios.post('https://api.prokip.africa/connector/api/sell', testSellBody, { headers });
        console.log('✅ Test response:', JSON.stringify(response.data, null, 2));
      }
      
    } catch (error) {
      console.log('❌ Could not get existing sales:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

findValidContact();
