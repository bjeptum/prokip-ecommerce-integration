require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkConnectionCredentials() {
  try {
    console.log('🔍 Checking WooCommerce connection credentials...\n');
    
    // Get the WooCommerce connection
    const connection = await prisma.connection.findFirst({
      where: { 
        platform: 'woocommerce',
        userId: 50 
      }
    });

    if (!connection) {
      console.log('❌ No WooCommerce connection found for user 50');
      return;
    }

    console.log('📋 Connection Details:');
    console.log(`   ID: ${connection.id}`);
    console.log(`   Store URL: ${connection.storeUrl}`);
    console.log(`   Platform: ${connection.platform}`);
    console.log(`   User ID: ${connection.userId}`);
    
    console.log('\n🔑 Authentication Methods Available:');
    console.log(`   Consumer Key: ${connection.consumerKey ? '✅ Present' : '❌ Missing'}`);
    console.log(`   Consumer Secret: ${connection.consumerSecret ? '✅ Present' : '❌ Missing'}`);
    console.log(`   Woo Username: ${connection.wooUsername ? '✅ Present' : '❌ Missing'}`);
    console.log(`   Woo App Password: ${connection.wooAppPassword ? '✅ Present' : '❌ Missing'}`);
    
    if (connection.consumerKey) {
      console.log(`   Consumer Key (first 20 chars): ${connection.consumerKey.substring(0, 20)}...`);
    }
    
    if (connection.wooUsername) {
      console.log(`   Woo Username: ${connection.wooUsername}`);
    }
    
    // Test the WooCommerce API connection
    console.log('\n🧪 Testing WooCommerce API connection...');
    
    const { getWooProducts } = require('./src/services/wooService');
    
    try {
      // Try with Consumer Key/Secret first
      if (connection.consumerKey && connection.consumerSecret) {
        console.log('🔑 Testing Consumer Key/Secret method...');
        const products = await getWooProducts(
          connection.storeUrl,
          connection.consumerKey,
          connection.consumerSecret
        );
        console.log(`✅ Consumer Key/Secret successful: ${products.length} products found`);
      }
    } catch (error) {
      console.log('❌ Consumer Key/Secret failed:', error.message);
      if (error.response?.data) {
        console.log('   Error details:', error.response.data);
      }
      
      // Try Application Password if available
      if (connection.wooUsername && connection.wooAppPassword) {
        console.log('\n🔐 Testing Application Password method...');
        try {
          const products = await getWooProducts(
            connection.storeUrl,
            null, null, null, null,
            connection.wooUsername,
            connection.wooAppPassword
          );
          console.log(`✅ Application Password successful: ${products.length} products found`);
        } catch (appError) {
          console.log('❌ Application Password failed:', appError.message);
          if (appError.response?.data) {
            console.log('   Error details:', appError.response.data);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking connection:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkConnectionCredentials();
