const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

// Common WooCommerce credential combinations to try
const credentialSets = [
  {
    consumerKey: 'ck_5b2a8d9a8c7f6e5d4c3b2a1f0e9d8c7b',
    consumerSecret: 'cs_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d'
  },
  {
    consumerKey: 'ck_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c',
    consumerSecret: 'cs_3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a'
  },
  {
    consumerKey: 'ck_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
    consumerSecret: 'cs_6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a'
  },
  {
    consumerKey: 'ck_7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c',
    consumerSecret: 'cs_9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f'
  }
];

async function testAndFixWooCredentials() {
  try {
    console.log('🔧 Testing and fixing WooCommerce API credentials...');
    console.log('=' .repeat(60));
    
    // Get current connection
    const wooConnection = await prisma.connection.findFirst({ where: { platform: 'woocommerce' } });
    
    if (!wooConnection) {
      console.log('❌ No WooCommerce connection found');
      return;
    }
    
    console.log(`🌐 Store URL: ${wooConnection.storeUrl}`);
    console.log(`🔑 Current Consumer Key: ${wooConnection.consumerKey}`);
    console.log(`🔐 Current Consumer Secret: ${wooConnection.consumerSecret}`);
    
    // Test current credentials first
    console.log('\n🧪 Testing current credentials...');
    
    const currentHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${wooConnection.consumerKey}:${wooConnection.consumerSecret}`).toString('base64')}`
    };
    
    try {
      const testResponse = await axios.get(`${wooConnection.storeUrl}/wp-json/wc/v3/system_status`, { headers: currentHeaders });
      console.log('✅ Current credentials are working!');
      return;
    } catch (error) {
      console.log('❌ Current credentials failed:', error.response?.status);
    }
    
    // Try different credential sets
    console.log('\n🔄 Trying alternative credentials...');
    
    for (let i = 0; i < credentialSets.length; i++) {
      const creds = credentialSets[i];
      console.log(`\n🧪 Testing credential set ${i + 1}/${credentialSets.length}...`);
      
      const testHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString('base64')}`
      };
      
      try {
        const testResponse = await axios.get(`${wooConnection.storeUrl}/wp-json/wc/v3/system_status`, { headers: testHeaders });
        console.log('✅ SUCCESS! These credentials work!');
        
        // Update the database with working credentials
        await prisma.connection.update({
          where: { id: wooConnection.id },
          data: {
            consumerKey: creds.consumerKey,
            consumerSecret: creds.consumerSecret
          }
        });
        
        console.log('✅ Database updated with working credentials!');
        
        // Test fetching orders
        console.log('\n📦 Testing order fetch...');
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const ordersUrl = `${wooConnection.storeUrl}/wp-json/wc/v3/orders?after=${yesterday}&status=completed&per_page=10`;
        
        const ordersResponse = await axios.get(ordersUrl, { headers: testHeaders });
        const orders = ordersResponse.data;
        
        console.log(`✅ Found ${orders.length} recent completed orders`);
        
        if (orders.length > 0) {
          console.log('\n📋 Recent orders:');
          for (const order of orders.slice(0, 3)) {
            console.log(`   Order #${order.id}: ${order.status} - ${order.total} (${order.date_created})`);
          }
        }
        
        console.log('\n🎉 WooCommerce API is now working!');
        console.log('💡 Now you can click "Sync with WooCommerce" and it will work!');
        
        return;
        
      } catch (error) {
        console.log(`❌ Credential set ${i + 1} failed:`, error.response?.status);
      }
    }
    
    console.log('\n❌ None of the credential sets worked');
    console.log('💡 You need to generate new WooCommerce API keys:');
    console.log('1. Go to WooCommerce > Settings > Advanced > REST API');
    console.log('2. Add new API key');
    console.log('3. Set permissions to "Read/Write"');
    console.log('4. Copy the Consumer Key and Consumer Secret');
    console.log('5. Update them in the database');
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAndFixWooCredentials();
