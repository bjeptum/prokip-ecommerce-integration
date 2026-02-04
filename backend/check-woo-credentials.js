const prisma = require('./src/lib/prisma');

async function checkWooCredentials() {
  try {
    const connection = await prisma.connection.findFirst({ where: { platform: 'woocommerce' } });
    if (connection) {
      console.log('🔧 WooCommerce Connection Found:');
      console.log('- Store URL:', connection.storeUrl);
      console.log('- Consumer Key present:', !!connection.consumerKey);
      console.log('- Consumer Secret present:', !!connection.consumerSecret);
      console.log('- Username present:', !!connection.wooUsername);
      console.log('- App Password present:', !!connection.wooAppPassword);
      console.log('- Access Token present:', !!connection.accessToken);
      console.log('- Access Token Secret present:', !!connection.accessTokenSecret);
    } else {
      console.log('❌ No WooCommerce connection found');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkWooCredentials();
