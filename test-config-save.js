// Quick test to verify the Prokip config save fix
const http = require('http');

function testProkipConfigSave() {
  console.log('🧪 Testing Prokip config save fix...\n');
  
  // Test the location save endpoint with sample data
  const postData = JSON.stringify({
    locationId: '21237',
    access_token: 'test_token_123',
    refresh_token: 'test_refresh_token',
    expires_in: 3600
  });
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/auth/prokip-location',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log(`Status: ${res.statusCode}`);
      try {
        const response = JSON.parse(data);
        console.log('Response:', response);
        
        if (res.statusCode === 200) {
          console.log('✅ Prokip config save is working!');
        } else {
          console.log('❌ Config save failed:', response.error);
        }
      } catch (e) {
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (err) => {
    console.error('❌ Request failed:', err.message);
  });
  
  req.write(postData);
  req.end();
}

testProkipConfigSave();
