const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function debugInventorySyncError() {
  try {
    console.log('🔍 DEBUGGING: /sync/inventory 500 error');
    console.log('=' .repeat(60));
    
    // 1. Test the exact endpoint that's failing
    console.log('\n🧪 1. TESTING /SYNC/INVENTORY ENDPOINT:');
    console.log('-'.repeat(50));
    
    try {
      // First get a valid token
      const loginResponse = await axios.post('http://localhost:3000/auth/login', {
        email: 'test@example.com',
        password: 'password'
      });
      
      let token;
      if (loginResponse.data.token) {
        token = loginResponse.data.token;
        console.log('✅ Got authentication token');
      } else {
        // Try with Prokip token
        const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId: 50 } });
        if (prokipConfig?.token) {
          token = prokipConfig.token;
          console.log('✅ Using Prokip token');
        }
      }
      
      if (!token) {
        console.log('❌ No authentication token available');
        return;
      }
      
      // Test with connection ID 6 (from the error logs)
      const testResponse = await axios.post('http://localhost:3000/sync/inventory', 
        { connectionId: 6 },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      console.log('✅ /sync/inventory working');
      console.log('📊 Response:', testResponse.data);
      
    } catch (error) {
      console.log('❌ /sync/inventory failed:', error.message);
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Data:', error.response.data);
      }
    }
    
    // 2. Check the userId issue
    console.log('\n🔍 2. CHECKING USERID ISSUE:');
    console.log('-'.repeat(50));
    
    try {
      const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId: 50 } });
      
      if (prokipConfig) {
        console.log('✅ Prokip config found for user 50');
        console.log('   Token present:', !!prokipConfig.token);
        console.log('   Location ID:', prokipConfig.locationId);
        
        // Test prokipService calls directly
        console.log('\n🧪 TESTING PROKIP SERVICE CALLS:');
        
        const prokipService = require('./src/services/prokipService');
        
        try {
          console.log('Testing getInventory(50)...');
          const inventory = await prokipService.getInventory(null, 50);
          console.log('✅ getInventory working, items:', inventory.length);
        } catch (error) {
          console.log('❌ getInventory failed:', error.message);
        }
        
        try {
          console.log('Testing getProducts(50)...');
          const products = await prokipService.getProducts(null, 50);
          console.log('✅ getProducts working, items:', products.length);
        } catch (error) {
          console.log('❌ getProducts failed:', error.message);
        }
        
      } else {
        console.log('❌ No Prokip config found for user 50');
      }
      
    } catch (error) {
      console.log('❌ Prokip config check failed:', error.message);
    }
    
    // 3. Check connection ID 6
    console.log('\n🔍 3. CHECKING CONNECTION ID 6:');
    console.log('-'.repeat(50));
    
    try {
      const connection = await prisma.connection.findUnique({
        where: { id: 6 }
      });
      
      if (connection) {
        console.log('✅ Connection 6 found:');
        console.log('   Platform:', connection.platform);
        console.log('   Store URL:', connection.storeUrl);
        console.log('   Consumer Key present:', !!connection.consumerKey);
        console.log('   Consumer Secret present:', !!connection.consumerSecret);
      } else {
        console.log('❌ Connection 6 not found');
      }
      
    } catch (error) {
      console.log('❌ Connection check failed:', error.message);
    }
    
    // 4. Test the authentication middleware
    console.log('\n🔍 4. TESTING AUTHENTICATION MIDDLEWARE:');
    console.log('-'.repeat(50));
    
    try {
      const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId: 50 } });
      
      if (prokipConfig?.token) {
        // Test with Prokip token
        const testResponse = await axios.get('http://localhost:3000/sync/status', {
          headers: { 'Authorization': `Bearer ${prokipConfig.token}` }
        });
        
        console.log('✅ Authentication middleware working with Prokip token');
        console.log('📊 Response:', testResponse.data);
      }
      
    } catch (error) {
      console.log('❌ Authentication middleware test failed:', error.message);
    }
    
    // 5. Identify the root cause
    console.log('\n🎯 5. ROOT CAUSE ANALYSIS:');
    console.log('-'.repeat(50));
    
    console.log('Based on the error analysis, the issue is likely:');
    console.log('1. ❌ userId is null or undefined in the sync/inventory endpoint');
    console.log('2. ❌ prokipService.getInventory(userId) fails with null userId');
    console.log('3. ❌ prokipService.getProducts(userId) fails with null userId');
    console.log('4. ❌ Authentication middleware not setting req.userId correctly');
    
    console.log('\n💡 SOLUTIONS NEEDED:');
    console.log('-'.repeat(50));
    console.log('1. Fix userId extraction in syncRoutes.js');
    console.log('2. Add proper error handling for null userId');
    console.log('3. Ensure authentication middleware sets req.userId');
    console.log('4. Add fallback userId if needed');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugInventorySyncError();
