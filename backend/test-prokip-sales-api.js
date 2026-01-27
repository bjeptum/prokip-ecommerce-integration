/**
 * Test Prokip sales API with different date formats
 */

const axios = require('axios');

async function testProkipSalesAPI() {
  try {
    console.log('🔍 Testing Prokip sales API with different date formats...\n');

    // Get Prokip config
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId: 50 } });
    if (!prokipConfig?.token) {
      console.error('❌ No Prokip config found');
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };

    // Test 1: No date filter (get all recent sales)
    console.log('📅 Test 1: No date filter');
    try {
      const response1 = await axios.get(
        `https://api.prokip.africa/connector/api/sell?location_id=${prokipConfig.locationId}&per_page=10`,
        { headers }
      );
      console.log(`✅ Found ${response1.data.data?.length || 0} sales without date filter`);
      if (response1.data.data?.length > 0) {
        console.log('Latest sale:', {
          id: response1.data.data[0].id,
          date: response1.data.data[0].transaction_date,
          status: response1.data.data[0].status
        });
      }
    } catch (error) {
      console.log('❌ Failed:', error.response?.status, error.response?.statusText);
    }

    // Test 2: Last 7 days
    console.log('\n📅 Test 2: Last 7 days');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    try {
      const response2 = await axios.get(
        `https://api.prokip.africa/connector/api/sell?location_id=${prokipConfig.locationId}&transaction_date_after=${sevenDaysAgo}&per_page=10`,
        { headers }
      );
      console.log(`✅ Found ${response2.data.data?.length || 0} sales in last 7 days`);
    } catch (error) {
      console.log('❌ Failed:', error.response?.status, error.response?.statusText);
    }

    // Test 3: Last 30 days
    console.log('\n📅 Test 3: Last 30 days');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    try {
      const response3 = await axios.get(
        `https://api.prokip.africa/connector/api/sell?location_id=${prokipConfig.locationId}&transaction_date_after=${thirtyDaysAgo}&per_page=10`,
        { headers }
      );
      console.log(`✅ Found ${response3.data.data?.length || 0} sales in last 30 days`);
      if (response3.data.data?.length > 0) {
        console.log('Recent sales:');
        response3.data.data.slice(0, 3).forEach(sale => {
          console.log(`- ID: ${sale.id}, Date: ${sale.transaction_date}, Status: ${sale.status}, Amount: ${sale.final_total}`);
        });
      }
    } catch (error) {
      console.log('❌ Failed:', error.response?.status, error.response?.statusText);
    }

    // Test 4: Different date format (YYYY-MM-DD)
    console.log('\n📅 Test 4: Date format YYYY-MM-DD');
    const today = new Date().toISOString().slice(0, 10);
    try {
      const response4 = await axios.get(
        `https://api.prokip.africa/connector/api/sell?location_id=${prokipConfig.locationId}&transaction_date=${today}&per_page=10`,
        { headers }
      );
      console.log(`✅ Found ${response4.data.data?.length || 0} sales for today (${today})`);
    } catch (error) {
      console.log('❌ Failed:', error.response?.status, error.response?.statusText);
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testProkipSalesAPI();
