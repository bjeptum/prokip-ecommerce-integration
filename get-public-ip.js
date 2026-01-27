/**
 * Get your public IP address for webhook configuration
 */

const https = require('https');
const os = require('os');

async function getPublicIP() {
  try {
    // Get public IP
    const publicIP = await new Promise((resolve, reject) => {
      https.get('https://api.ipify.org?format=json', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data).ip);
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });

    // Get local IP
    const interfaces = os.networkInterfaces();
    let localIP = null;
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIP = iface.address;
          break;
        }
      }
      if (localIP) break;
    }

    console.log('🌐 Network Information:');
    console.log(`Public IP: ${publicIP}`);
    console.log(`Local IP: ${localIP}`);
    console.log(`Computer Name: ${os.hostname()}`);
    
    console.log('\n📡 Webhook URL Options:');
    console.log(`1. With ngrok: https://abc123.ngrok.io/connections/webhook/woocommerce`);
    console.log(`2. With public IP: http://${publicIP}:3000/connections/webhook/woocommerce`);
    console.log(`3. With local IP (if on same network): http://${localIP}:3000/connections/webhook/woocommerce`);
    
    console.log('\n⚠️ Important:');
    console.log('- For public IP, make sure port 3000 is open in your firewall');
    console.log('- ngrok is recommended for testing');
    console.log('- Local IP only works if WooCommerce and server are on same network');

  } catch (error) {
    console.error('❌ Error getting IP:', error.message);
  }
}

getPublicIP();
