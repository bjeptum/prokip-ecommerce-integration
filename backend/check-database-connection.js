const { PrismaClient } = require('@prisma/client');

async function checkDatabaseConnection() {
  try {
    console.log('🔍 CHECKING: Database connection and data');
    console.log('=' .repeat(60));
    
    // Check database URL from environment
    console.log('\n🔗 DATABASE CONNECTION INFO:');
    console.log('-'.repeat(40));
    console.log('Database URL:', process.env.DATABASE_URL ? 'Present' : 'Missing');
    
    if (process.env.DATABASE_URL) {
      // Hide password in logs
      const maskedUrl = process.env.DATABASE_URL.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
      console.log('Masked URL:', maskedUrl);
    }
    
    // Test database connection
    console.log('\n🧪 TESTING DATABASE CONNECTION:');
    console.log('-'.repeat(40));
    
    const prisma = new PrismaClient();
    
    try {
      await prisma.$connect();
      console.log('✅ Database connection successful');
    } catch (error) {
      console.log('❌ Database connection failed:', error.message);
      return;
    }
    
    // Check all tables
    console.log('\n📊 CHECKING TABLES:');
    console.log('-'.repeat(40));
    
    try {
      // Check connections table
      const connections = await prisma.connection.findMany();
      console.log(`✅ Connections table: ${connections.length} records`);
      
      // Show all connections
      console.log('\n📋 ALL CONNECTIONS:');
      for (const conn of connections) {
        console.log(`  ID: ${conn.id}`);
        console.log(`  Platform: ${conn.platform}`);
        console.log(`  Store URL: ${conn.storeUrl}`);
        console.log(`  Consumer Key: ${conn.consumerKey ? 'Present' : 'Missing'}`);
        console.log(`  Consumer Secret: ${conn.consumerSecret ? 'Present' : 'Missing'}`);
        console.log('---');
      }
      
      // Check prokipConfig table
      const prokipConfigs = await prisma.prokipConfig.findMany();
      console.log(`✅ ProkipConfig table: ${prokipConfigs.length} records`);
      
      // Show all Prokip configs
      console.log('\n📋 ALL PROKIP CONFIGS:');
      for (const config of prokipConfigs) {
        console.log(`  ID: ${config.id}`);
        console.log(`  User ID: ${config.userId}`);
        console.log(`  Token: ${config.token ? 'Present' : 'Missing'}`);
        console.log(`  Location ID: ${config.locationId}`);
        console.log('---');
      }
      
      // Check salesLog table
      const salesLogs = await prisma.salesLog.findMany({
        orderBy: { orderDate: 'desc' },
        take: 10
      });
      console.log(`✅ SalesLog table: ${salesLogs.length} recent records`);
      
      // Show recent logs
      console.log('\n📋 RECENT SALES LOGS:');
      for (const log of salesLogs) {
        console.log(`  Order ID: ${log.orderId}`);
        console.log(`  Customer: ${log.customerName}`);
        console.log(`  Amount: ${log.totalAmount}`);
        console.log(`  Date: ${log.orderDate}`);
        console.log('---');
      }
      
    } catch (error) {
      console.log('❌ Error checking tables:', error.message);
    }
    
    // Check if we're using the right database by looking for specific data
    console.log('\n🎯 CHECKING IF THIS IS THE RIGHT DATABASE:');
    console.log('-'.repeat(40));
    
    try {
      // Look for WooCommerce connection specifically
      const wooConnection = await prisma.connection.findFirst({ 
        where: { platform: 'woocommerce' } 
      });
      
      if (wooConnection) {
        console.log('✅ Found WooCommerce connection');
        console.log(`  Store URL: ${wooConnection.storeUrl}`);
        console.log(`  Platform: ${wooConnection.platform}`);
        
        // Check if the store URL matches what you expect
        const expectedUrls = [
          'https://prowebfunnels.com/kenditrades/',
          'https://learn.prokip.africa/',
          'https://kenditrades.com'
        ];
        
        const urlMatches = expectedUrls.some(url => wooConnection.storeUrl.includes(url));
        console.log(`  URL matches expected: ${urlMatches ? '✅' : '❌'}`);
        
        if (!urlMatches) {
          console.log('  ⚠️ This might not be the right database!');
          console.log('  Expected URLs:', expectedUrls);
        }
        
      } else {
        console.log('❌ No WooCommerce connection found');
        console.log('  This might not be the right database!');
      }
      
      // Look for Prokip config
      const prokipConfig = await prisma.prokipConfig.findFirst({ 
        where: { userId: 50 } 
      });
      
      if (prokipConfig) {
        console.log('✅ Found Prokip config for user 50');
        console.log(`  Location ID: ${prokipConfig.locationId}`);
        console.log(`  Token: ${prokipConfig.token ? 'Present' : 'Missing'}`);
      } else {
        console.log('❌ No Prokip config found for user 50');
        console.log('  This might not be the right database!');
      }
      
    } catch (error) {
      console.log('❌ Error checking database content:', error.message);
    }
    
    console.log('\n💡 DATABASE CHECK SUMMARY:');
    console.log('-'.repeat(40));
    console.log('1. Database connection: Working ✅' || 'Not Working ❌');
    console.log('2. Tables exist: ✅' || '❌');
    console.log('3. WooCommerce connection: Found ✅' || 'Not Found ❌');
    console.log('4. Prokip config: Found ✅' || 'Not Found ❌');
    console.log('5. Store URL matches expected: ✅' || '❌');
    
    console.log('\n🔧 IF THIS IS THE WRONG DATABASE:');
    console.log('-'.repeat(40));
    console.log('1. Check your .env file for DATABASE_URL');
    console.log('2. Make sure it points to the correct PostgreSQL database');
    console.log('3. Verify the database contains your WooCommerce connection');
    console.log('4. Update the DATABASE_URL if needed');
    
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  }
}

checkDatabaseConnection();
