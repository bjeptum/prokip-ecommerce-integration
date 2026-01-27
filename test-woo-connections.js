// Test WooCommerce connection endpoints with Prokip token
const http = require('http');

function testWooCommerceConnections() {
  console.log('🧪 Testing WooCommerce connection endpoints...\n');
  
  // Use the Prokip token from frontend logs
  const prokipToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImY0NWFlNjQ5NzI3ZjQ3ZmYzZjBmMGYzZWE5ZWJlNTBmZjhjNDg3YjRlMjVlZGVlOTM1MmFhNDI4YWU2OTk0MzRkMGQ3OGEwYWU3In0.eyJhdWQiOiI2IiwianRpIjoiImY0NWFlNjQ5NzI3ZjQ3ZmYzZjBmMGYzZWE5ZWJlNTBmZjhjNDg3YjRlMjVlZGVlOTM1MmFhNDI4YWU2OTk0MzRkMGQ3OGEwYWU3IiwiaWF0IjoxNzY4MTYxNjQ0LCJuYmYiOjE3NjgxNjE2NDQsImV4cCI6MTc5OTY5NjA0NCwic3ViIjoiNDQ4ODEiLCJzY29wZXMiOl19';
  
  // Test 1: WooCommerce connection test
  console.log('1. Testing WooCommerce connection test...');
  testWooEndpoint('/woo-connections/test', prokipToken, {
    storeUrl: 'https://prowebfunnels.com/kenditrades/',
    consumerKey: 'test_key',
    consumerSecret: 'test_secret'
  }, 'WooCommerce test');
  
  // Test 2: WooCommerce connection connect
  console.log('\n2. Testing WooCommerce connection connect...');
  testWooEndpoint('/woo-connections/connect', prokipToken, {
    storeUrl: 'https://prowebfunnels.com/kenditrades/',
    username: 'test_user',
    password: 'test_password'
  }, 'WooCommerce connect');
  
  // Test 3: Store products (should work now)
  console.log('\n3. Testing store products...');
  testEndpoint('/stores/1/products', prokipToken, 'Store products');
  
  console.log('\n🎉 All WooCommerce connection tests completed!');
  console.log('\n📋 Expected Results:');
  console.log('- WooCommerce endpoints: Should work with Prokip token');
  console.log('- Store products: Should work with Prokip token');
}

function testWooEndpoint(path, token, body, description) {
  const postData = JSON.stringify(body);
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: path,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log(`${description} status: ${res.statusCode}`);
      
      if (res.statusCode === 200) {
        console.log(`✅ ${description} working!`);
        try {
          const response = JSON.parse(data);
          console.log(`   Response: ${response.success ? 'Success' : 'Failed'}`);
        } catch (e) {
          // Ignore JSON parse errors
        }
      } else if (res.statusCode === 401) {
        console.log(`❌ ${description} - No token provided`);
      } else if (res.statusCode === 403) {
        console.log(`❌ ${description} - Invalid token`);
      } else if (res.statusCode === 400) {
        console.log(`⚠️ ${description} - Bad request (expected with test data)`);
      } else {
        console.log(`⚠️ ${description} status: ${res.statusCode}`);
      }
    });
  });

  req.on('error', (err) => {
    console.error(`❌ ${description} request failed:`, err.message);
  });
  
  req.write(postData);
  req.end();
}

function testEndpoint(path, token, description) {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: path,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log(`${description} status: ${res.statusCode}`);
      
      if (res.statusCode === 200) {
        console.log(`✅ ${description} working!`);
      } else if (res.statusCode === 401) {
        console.log(`❌ ${description} - Authentication failed`);
      } else if (res.statusCode === 403) {
        console.log(`❌ ${description} - Invalid token`);
      } else {
        console.log(`⚠️ ${description} status: ${res.statusCode}`);
      }
    });
  });

  req.on('error', (err) => {
    console.error(`❌ ${description} request failed:`, err.message);
  });
  
  req.end();
}

testWooCommerceConnections();
