const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function checkWooConnection() {
  try {
    const connection = await prisma.connection.findFirst({
      where: { platform: 'woocommerce' }
    });
    
    if (!connection) {
      console.log('❌ No WooCommerce connection found');
      return;
    }
    
    console.log('📋 WooCommerce connection details:');
    console.log(`- Store URL: ${connection.storeUrl}`);
    console.log(`- Consumer Key: ${connection.consumerKey ? 'Present' : 'Missing'}`);
    console.log(`- Consumer Secret: ${connection.consumerSecret ? 'Present' : 'Missing'}`);
    
    // Test the connection
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${connection.consumerKey}:${connection.consumerSecret}`).toString('base64')}`
    };
    
    console.log('🔍 Testing WooCommerce API connection...');
    
    try {
      const response = await axios.get(`${connection.storeUrl}/wp-json/wc/v3/system_status`, { headers });
      console.log('✅ WooCommerce API connection successful');
      console.log('📊 System status:', response.data.environment?.wc_version || 'Unknown');
    } catch (error) {
      console.log('❌ WooCommerce API connection failed:');
      console.log(`Status: ${error.response?.status}`);
      console.log(`Message: ${error.response?.data?.message || error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkWooConnection();
