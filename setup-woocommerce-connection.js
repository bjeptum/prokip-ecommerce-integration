// WooCommerce Connection Setup Script
const axios = require('axios');

const API_BASE = 'http://localhost:3000';

async function setupWooCommerceConnection() {
  console.log('🔗 Setting up WooCommerce connection to Prokip...\n');
  
  // Step 1: Connect WooCommerce store
  console.log('1. Connecting WooCommerce store...');
  
  try {
    const connectResponse = await axios.post(`${API_BASE}/connections/woocommerce/connect`, {
      storeUrl: 'https://prowebfunnels.com/kenditrades/',
      username: 'your_wordpress_username',  // Replace with your WordPress admin username
      password: 'your_wordpress_password'   // Replace with your WordPress admin password
    });
    
    if (connectResponse.data.success) {
      console.log('✅ WooCommerce connected successfully!');
      console.log('Store URL:', connectResponse.data.storeUrl);
      console.log('App Name:', connectResponse.data.appName);
      
      // Step 2: Test the sync status
      console.log('\n2. Testing sync status...');
      const statusResponse = await axios.get(`${API_BASE}/connections/status`);
      
      if (statusResponse.data.stores && statusResponse.data.stores.length > 0) {
        console.log('✅ Connection status:');
        statusResponse.data.stores.forEach(store => {
          console.log(`  - ${store.platform}: ${store.storeUrl}`);
          console.log(`    Sync Enabled: ${store.syncEnabled}`);
          console.log(`    Last Sync: ${store.lastSync}`);
        });
      }
      
      console.log('\n🎉 Connection setup complete!');
      console.log('\n📋 What happens next:');
      console.log('1. WooCommerce orders will sync to Prokip as sales');
      console.log('2. Prokip products can sync to WooCommerce');
      console.log('3. Inventory will be kept in sync between both systems');
      console.log('\n🔍 To test:');
      console.log('- Create a test order in WooCommerce');
      console.log('- Check if it appears as a sale in Prokip');
      console.log('- Add products in Prokip');
      console.log('- Check if they appear in WooCommerce');
      
    } else {
      console.log('❌ WooCommerce connection failed:', connectResponse.data.error);
    }
    
  } catch (error) {
    console.error('❌ Connection setup failed:', error.response?.data || error.message);
  }
}

// Instructions
console.log('📖 WooCommerce Connection Setup Instructions:\n');
console.log('1. Replace "your_wordpress_username" with your WordPress admin username');
console.log('2. Replace "your_wordpress_password" with your WordPress admin password');
console.log('3. Run: node setup-woocommerce-connection.js\n');
console.log('4. Or use the frontend interface at: http://localhost:3000\n');
console.log('5. The system will automatically sync data between Prokip and WooCommerce\n');

setupWooCommerceConnection();
