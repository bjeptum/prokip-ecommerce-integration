const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { decryptCredentials } = require('./src/services/storeService');

const prisma = new PrismaClient();

async function createTestOrder() {
  try {
    console.log('🧪 Creating a test WooCommerce order...');
    
    // Get WooCommerce connection
    const wooConnection = await prisma.connection.findFirst({ 
      where: { platform: 'woocommerce' } 
    });
    
    if (!wooConnection) {
      console.error('❌ WooCommerce connection not found');
      return;
    }
    
    // Decrypt credentials
    const { consumerKey, consumerSecret } = decryptCredentials(wooConnection);
    
    const wooHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`
    };
    
    // Create a test order
    const orderData = {
      status: 'completed',
      total: '100.00',
      line_items: [
        {
          name: 'Test Product',
          sku: '4848961', // Hair cream - we know this has stock
          quantity: 1,
          price: '100.00',
          total: '100.00'
        }
      ],
      billing: {
        first_name: 'Test',
        last_name: 'Customer',
        email: 'test@example.com'
      }
    };
    
    console.log('📝 Creating test order...');
    const response = await axios.post(
      `${wooConnection.storeUrl}/wp-json/wc/v3/orders`,
      orderData,
      { headers: wooHeaders }
    );
    
    const newOrder = response.data;
    console.log(`✅ Test order created: #${newOrder.id}`);
    console.log(`  - Status: ${newOrder.status}`);
    console.log(`  - Total: ${newOrder.total}`);
    console.log(`  - Items: ${newOrder.line_items.length}`);
    
    // Now test the sync with this new order
    console.log('\n🔄 Testing sync with new order...');
    
    const syncResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }
    });
    
    console.log('✅ Sync completed!');
    console.log('Sync results:', syncResponse.data.results);
    
    // Check the inventory after sync
    console.log('\n📦 Checking inventory after sync...');
    const inventoryLog = await prisma.inventoryLog.findFirst({
      where: {
        connectionId: wooConnection.id,
        sku: '4848961'
      }
    });
    
    if (inventoryLog) {
      console.log(`  - SKU 4848961: ${inventoryLog.quantity} units`);
    }
    
    console.log('\n🎉 Test completed successfully!');
    
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

createTestOrder();
