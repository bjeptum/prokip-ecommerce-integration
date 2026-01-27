// Test all fixes for WooCommerce integration
const http = require('http');

function testAllFixes() {
  console.log('🧪 Testing all WooCommerce integration fixes...\n');
  
  // Use the Prokip token from the frontend logs
  const prokipToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImY0NWFlNjQ5NzI3ZjQ3ZmYzZjBmMGYzZWE5ZWJlNTBmZjhjNDg3YjRlMjVlZGVlOTM1MmFhNDI4YWU2OTk0MzRkMGQ3OGEwYWU3In0.eyJhdWQiOiI2IiwianRpIjoiImY0NWFlNjQ5NzI3ZjQ3ZmYzZjBmMGYzZWE5ZWJlNTBmZjhjNDg3YjRlMjVlZGVlOTM1MmFhNDI4YWU2OTk0MzRkMGQ3OGEwYWU3IiwiaWF0IjoxNzY4MTYxNjQ0LCJuYmYiOjE3NjgxNjE2NDQsImV4cCI6MTc5OTY5NjA0NCwic3ViIjoiNDQ4ODEiLCJzY29wZXMiOl19';
  
  // Test 1: Prokip products (should work)
  console.log('1. Testing Prokip products...');
  testEndpoint('/prokip/products', prokipToken, 'Prokip products');
  
  // Test 2: WooCommerce store products (should work now)
  console.log('\n2. Testing WooCommerce store products...');
  testEndpoint('/stores/1/products', prokipToken, 'WooCommerce products');
  
  // Test 3: WooCommerce store orders (should work now)
  console.log('\n3. Testing WooCommerce store orders...');
  testEndpoint('/stores/1/orders', prokipToken, 'WooCommerce orders');
  
  // Test 4: Setup products (should work now)
  console.log('\n4. Testing setup products...');
  testEndpoint('/setup/products', prokipToken, 'Setup products');
  
  // Test 5: Setup products matches (should work now)
  console.log('\n5. Testing setup products matches...');
  testEndpoint('/setup/products/matches?connectionId=1', prokipToken, 'Setup products matches');
  
  // Test 6: Setup readiness check (should work now)
  console.log('\n6. Testing setup readiness check...');
  testEndpointWithBody('/setup/products/readiness-check', prokipToken, { connectionId: 1 }, 'Setup readiness check');
  
  console.log('\n🎉 All tests completed!');
  console.log('\n📋 Expected Results:');
  console.log('- Prokip routes: Should work with Prokip token');
  console.log('- WooCommerce routes: Should work with Prokip token (user ID fixed)');
  console.log('- Setup routes: Should work with Prokip token (auth updated)');
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
        try {
          const response = JSON.parse(data);
          if (Array.isArray(response)) {
            console.log(`   📦 Found ${response.length} items`);
          } else if (response.products) {
            console.log(`   📦 Found ${response.products.length} products`);
          }
        } catch (e) {
          // Ignore JSON parse errors for now
        }
      } else if (res.statusCode === 401) {
        console.log(`❌ ${description} authentication issue`);
      } else if (res.statusCode === 404) {
        console.log(`❌ ${description} not found`);
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

function testEndpointWithBody(path, token, body, description) {
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
      } else if (res.statusCode === 401) {
        console.log(`❌ ${description} authentication issue`);
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

testAllFixes();
