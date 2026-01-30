const { PrismaClient } = require('@prisma/client');
const prokipService = require('./src/services/prokipService');
const { mapOrderToProkipSell } = require('./src/services/prokipMapper');

const prisma = new PrismaClient();

async function simulateWooCommerceOrder() {
  console.log('🛒 Simulating WooCommerce Order Processing');
  console.log('===========================================');

  try {
    // 1. Create a mock WooCommerce order
    const mockOrder = {
      id: 14250,
      number: '14250',
      status: 'completed',
      date_created: '2025-01-28T10:30:00',
      total: '150.00',
      discount_total: '10.00',
      total_tax: '15.00',
      customer: {
        first_name: 'John',
        email: 'john@example.com'
      },
      billing: {
        first_name: 'John',
        email: 'john@example.com'
      },
      line_items: [
        {
          id: 1,
          name: 'Hair cream',
          sku: '4848961',
          quantity: 2,
          price: '75.00',
          total_tax: '7.50'
        },
        {
          id: 2,
          name: 'Claire Wash',
          sku: '4815445',
          quantity: 1,
          price: '60.00',
          total_tax: '6.00'
        }
      ]
    };

    console.log('\n📦 Mock Order Details:');
    console.log(`   Order ID: ${mockOrder.id}`);
    console.log(`   Status: ${mockOrder.status}`);
    console.log(`   Total: ${mockOrder.total}`);
    console.log(`   Items: ${mockOrder.line_items.length}`);

    // 2. Get Prokip configuration
    console.log('\n2️⃣ Getting Prokip configuration...');
    const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId: 50 } });
    if (!prokipConfig) {
      console.error('❌ Prokip configuration not found');
      return;
    }
    console.log(`✅ Prokip location: ${prokipConfig.locationId}`);

    // 3. Get connection details
    console.log('\n3️⃣ Getting store connection...');
    const connection = await prisma.connection.findFirst({ 
      where: { platform: 'woocommerce' }
    });
    if (!connection) {
      console.error('❌ WooCommerce connection not found');
      return;
    }
    console.log(`✅ Store: ${connection.storeUrl}`);

    // 4. Map order to Prokip format
    console.log('\n4️⃣ Mapping order to Prokip format...');
    const sellBody = await mapOrderToProkipSell(mockOrder, prokipConfig.locationId, 'woocommerce', 50);
    if (!sellBody) {
      console.error('❌ Failed to map order to Prokip format');
      return;
    }
    console.log('✅ Order mapped successfully');
    console.log(`   Invoice: ${sellBody.sells[0].invoice_no}`);
    console.log(`   Products: ${sellBody.sells[0].products.length}`);

    // 5. Check current inventory
    console.log('\n5️⃣ Checking current inventory...');
    for (const item of mockOrder.line_items) {
      if (item.sku) {
        const inventoryLog = await prisma.inventoryLog.findFirst({
          where: { 
            connectionId: connection.id,
            sku: item.sku 
          }
        });
        
        if (inventoryLog) {
          console.log(`   ${item.sku}: ${inventoryLog.quantity} units available`);
        } else {
          console.log(`   ${item.sku}: No inventory record found`);
        }
      }
    }

    // 6. Record sale in Prokip
    console.log('\n6️⃣ Recording sale in Prokip...');
    const headers = await prokipService.getAuthHeaders(50);
    const PROKIP_BASE = process.env.PROKIP_API + '/connector/api/';
    
    const response = await require('axios').post(PROKIP_BASE + 'sell', sellBody, { headers });
    const prokipSellId = response.data?.data?.[0]?.id || response.data?.id || null;
    
    if (prokipSellId) {
      console.log(`✅ Sale recorded in Prokip (ID: ${prokipSellId})`);
    } else {
      console.log('⚠️ Sale recorded but no Prokip ID returned');
    }

    // 7. Create sales log entry
    console.log('\n7️⃣ Creating sales log entry...');
    await prisma.salesLog.create({
      data: {
        connectionId: connection.id,
        orderId: mockOrder.id.toString(),
        orderNumber: mockOrder.number,
        invoiceNo: sellBody.sells[0].invoice_no,
        platform: 'woocommerce',
        customerName: mockOrder.customer.first_name,
        customerEmail: mockOrder.customer.email,
        totalAmount: parseFloat(mockOrder.total),
        status: 'completed',
        orderDate: new Date(mockOrder.date_created),
        prokipSellId: prokipSellId,
        stockDeducted: true,
        stockDeductionDate: new Date()
      }
    });
    console.log('✅ Sales log created');

    // 8. Update local inventory cache
    console.log('\n8️⃣ Updating local inventory cache...');
    for (const item of mockOrder.line_items) {
      if (item.sku) {
        const inventoryLog = await prisma.inventoryLog.findFirst({
          where: { 
            connectionId: connection.id,
            sku: item.sku 
          }
        });

        if (inventoryLog) {
          const newQuantity = Math.max(0, inventoryLog.quantity - item.quantity);
          await prisma.inventoryLog.update({
            where: { id: inventoryLog.id },
            data: { 
              quantity: newQuantity,
              lastSynced: new Date()
            }
          });
          console.log(`   ${item.sku}: ${inventoryLog.quantity} → ${newQuantity}`);
        }
      }
    }

    console.log('\n✅ Order processing completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Order ${mockOrder.id} processed`);
    console.log(`   - Prokip sale ID: ${prokipSellId}`);
    console.log(`   - Inventory updated for ${mockOrder.line_items.length} products`);
    console.log(`   - Local cache synchronized`);

  } catch (error) {
    console.error('❌ Order processing failed:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the simulation
simulateWooCommerceOrder();
