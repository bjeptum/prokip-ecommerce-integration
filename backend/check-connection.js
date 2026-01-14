const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const conn = await prisma.connection.findUnique({ where: { id: 2 } });
  console.log('Connection ID 2:', {
    id: conn?.id,
    platform: conn?.platform,
    storeUrl: conn?.storeUrl,
    hasAccessToken: !!conn?.accessToken,
    accessTokenLength: conn?.accessToken?.length || 0,
    userId: conn?.userId
  });
  
  // If Shopify, try a test API call
  if (conn && conn.platform === 'shopify' && conn.accessToken) {
    const axios = require('axios');
    try {
      console.log('\nTesting Shopify API...');
      const response = await axios.get(`https://${conn.storeUrl}/admin/api/2026-01/products.json?limit=1`, {
        headers: { 'X-Shopify-Access-Token': conn.accessToken }
      });
      console.log('✅ Shopify API working! Products:', response.data?.products?.length);
    } catch (error) {
      console.log('❌ Shopify API error:', error.response?.status, error.response?.data || error.message);
    }
  }
  
  await prisma.$disconnect();
})();
