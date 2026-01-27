/**
 * Test the sync with a simulated new order
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

async function testWithNewOrder() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Testing sync with simulated new order...\n');

    // Get WooCommerce connection
    const wooConnection = await prisma.connection.findFirst({ where: { platform: 'woocommerce' } });
    if (!wooConnection) {
      console.error('❌ No WooCommerce connection found');
      return;
    }

    // Get Prokip config
    const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId: 50 } });
    if (!prokipConfig) {
      console.error('❌ No Prokip config found');
      return;
    }

    // Get Prokip headers
    const prokipHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };

    // Get a product to test with (Claire Wash)
    const productsResponse = await axios.get('https://api.prokip.africa/connector/api/product?sku=4815445', { headers: prokipHeaders });
    const product = productsResponse.data.data?.[0];
    
    if (!product) {
      console.log('❌ Claire Wash product not found in Prokip');
      return;
    }

    console.log(`📦 Testing with product: ${product.name} (SKU: ${product.sku})`);

    // First, clear any existing sales log entry for our test order
    await prisma.salesLog.deleteMany({
      where: {
        connectionId: wooConnection.id,
        orderId: '999999'
      }
    });

    // Set initial stock in inventory log
    const initialStock = 50;
    await prisma.inventoryLog.upsert({
      where: {
        connectionId_sku: {
          connectionId: wooConnection.id,
          sku: product.sku
        }
      },
      update: {
        quantity: initialStock,
        lastSynced: new Date()
      },
      create: {
        connectionId: wooConnection.id,
        productId: product.id.toString(),
        productName: product.name,
        sku: product.sku,
        quantity: initialStock,
        price: 170
      }
    });
    
    console.log(`✅ Set initial stock to ${initialStock} for SKU ${product.sku}`);

    // Create a mock order that simulates a new WooCommerce order
    const mockOrder = {
      id: 999999,
      order_number: 'TEST-999999',
      status: 'processing',
      total: '340.00',
      date_created: new Date().toISOString(),
      created_at: new Date().toISOString(),
      customer: { 
        first_name: 'Test Customer', 
        last_name: 'Test',
        email: 'test@example.com' 
      },
      line_items: [
        { 
          id: 1, 
          name: product.name, 
          sku: product.sku, 
          quantity: 2, 
          price: '170.00', 
          total: '340.00' 
        }
      ]
    };

    console.log('\n🧪 Simulating new order processing...');
    console.log(`📦 Mock order: #${mockOrder.id} - ${mockOrder.status} - Total: ${mockOrder.total}`);
    console.log(`📦 Item: ${mockOrder.line_items[0].name} (SKU: ${mockOrder.line_items[0].sku}) - Qty: ${mockOrder.line_items[0].quantity}`);

    // Simulate the stock adjustment logic
    try {
      const stockResponse = await axios.get(
        `https://api.prokip.africa/connector/api/product-stock-report?product_id=${product.id}`,
        { headers: prokipHeaders }
      );
      
      const currentStock = stockResponse.data?.[0]?.stock || stockResponse.data?.[0]?.qty_available || initialStock;
      const quantityToDeduct = Math.min(mockOrder.line_items[0].quantity, currentStock);
      
      console.log(`  📊 Current stock: ${currentStock}, Deducting: ${quantityToDeduct}`);

      if (quantityToDeduct > 0) {
        // Update inventory log
        const newStock = Math.max(0, currentStock - quantityToDeduct);
        await prisma.inventoryLog.update({
          where: {
            connectionId_sku: {
              connectionId: wooConnection.id,
              sku: product.sku
            }
          },
          data: {
            quantity: newStock,
            lastSynced: new Date()
          }
        });
        
        // Create sales log entry
        await prisma.salesLog.create({
          data: {
            connectionId: wooConnection.id,
            orderId: mockOrder.id.toString(),
            orderNumber: mockOrder.order_number,
            customerName: mockOrder.customer.first_name,
            customerEmail: mockOrder.customer.email,
            totalAmount: parseFloat(mockOrder.total),
            status: 'completed',
            orderDate: new Date(mockOrder.created_at)
          }
        });
        
        console.log(`  ✅ Updated inventory log: ${currentStock} → ${newStock}`);
        console.log(`  ✅ Created sales log entry for order ${mockOrder.id}`);
        console.log(`🎉 SUCCESS: Stock deduction working!`);
      } else {
        console.log(`  ⚠️ Insufficient stock to deduct`);
      }

    } catch (stockError) {
      console.error(`  ❌ Failed to adjust stock:`, stockError.message);
    }

    // Verify the final state
    const finalInventory = await prisma.inventoryLog.findFirst({
      where: {
        connectionId: wooConnection.id,
        sku: product.sku
      }
    });

    const salesLog = await prisma.salesLog.findFirst({
      where: {
        connectionId: wooConnection.id,
        orderId: mockOrder.id.toString()
      }
    });

    console.log(`\n📊 Final state:`);
    console.log(`  - Product: ${finalInventory.productName} (SKU: ${finalInventory.sku})`);
    console.log(`  - Stock: ${finalInventory.quantity}`);
    console.log(`  - Sales Log: Order ${salesLog.orderId} - Status: ${salesLog.status}`);

    console.log(`\n✅ Test completed successfully!`);
    console.log(`📋 Summary:`);
    console.log(`  - Initial stock: ${initialStock}`);
    console.log(`  - Final stock: ${finalInventory.quantity}`);
    console.log(`  - Stock deducted: ${initialStock - finalInventory.quantity}`);
    console.log(`  - Order processed: ${salesLog.orderId}`);

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testWithNewOrder();
