const http = require('http');
const fs = require('fs');
const url = require('url');
const querystring = require('querystring');

// In-memory cache, save to file for persistence
let data = { connections: [], inventory: {}, sales: [] };
const dataFile = 'connections.json';

// Load data from file if exists
if (fs.existsSync(dataFile)) {
  data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

// Function to save data to file
function saveData() {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

// Create server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Serve static files from /public
  if (pathname.startsWith('/public/')) {
    const filePath = '.' + pathname;
    if (fs.existsSync(filePath)) {
      const contentType = filePath.endsWith('.css') ? 'text/css' : 'text/html';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(fs.readFileSync(filePath));
    } else {
      res.writeHead(404);
      res.end('File not found');
    }
    return;
  }

  // Root: Serve index.html
  if (pathname === '/' || pathname === '/index.html') {
    serveFile(res, '/public/index.html');
    return;
  }

  // Setup page
  if (pathname === '/setup') {
    serveFile(res, '/public/setup.html');
    return;
  }

  // API: Get connections list
  if (pathname === '/api/connections' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data.connections));
    return;
  }

  // Connect to platform (simulate OAuth)
  if (pathname.startsWith('/connect/') && method === 'GET') {
    const platform = pathname.split('/connect/')[1];
    // Simulate redirect back with token (in real: handle OAuth callback)
    const token = 'fake_token_' + platform; // Replace with real OAuth
    const storeName = platform.charAt(0).toUpperCase() + platform.slice(1) + ' Store';
    data.connections.push({
      platform,
      storeName,
      token,
      status: 'connected',
      lastSync: new Date().toISOString(),
      syncEnabled: true,
      locationId: parsedUrl.query.location || 'default'
    });
    saveData();
    res.writeHead(302, { Location: '/setup?platform=' + platform });
    res.end();
    return;
  }

  // Setup choice (pull or push)
  if (pathname === '/api/setup' && method === 'POST') {
    getPostBody(req, (body) => {
      const { platform, choice } = querystring.parse(body);
      // Find connection
      const conn = data.connections.find(c => c.platform === platform);
      if (conn) {
        conn.choice = choice;
        saveData();
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Setup choice saved: ' + choice);
      } else {
        res.writeHead(404);
        res.end('Connection not found');
      }
    });
    return;
  }

  // Pull products (Store -> Prokip)
  if (pathname === '/api/pull' && method === 'POST') {
    getPostBody(req, (body) => {
      const { platform } = querystring.parse(body);
      // Fake fetch products from store
      const storeProducts = [
        { sku: 'shirt1', name: 'T-Shirt', price: 20, quantity: 100 },
        { sku: 'pants1', name: 'Pants', price: 30, quantity: 50 }
      ];
      // Fake Prokip products
      const prokipProducts = { 'shirt1': { quantity: 90 } }; // Partial match
      // Match by SKU
      const matches = storeProducts.map(p => ({
        ...p,
        status: prokipProducts[p.sku] ? 'matched' : 'needs_attention'
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(matches));
    });
    return;
  }

  // Push products (Prokip -> Store)
  if (pathname === '/api/push' && method === 'POST') {
    getPostBody(req, (body) => {
      const parsed = querystring.parse(body);
      // Fake Prokip products
      let products = [
        { sku: 'shirt1', name: 'T-Shirt', price: parsed.price_shirt1 || 20, image: parsed.image_shirt1 || '', quantity: 100 }
      ];
      // Check readiness
      products = products.map(p => ({
        ...p,
        ready: p.name && p.sku && p.price && p.image ? true : false
      }));
      // "Publish" - update inventory
      products.forEach(p => { if (p.ready) data.inventory[p.sku] = p; });
      saveData();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(products));
    });
    return;
  }

  // Webhook for sync
  if (pathname.startsWith('/webhook/') && method === 'POST') {
    const platform = pathname.split('/webhook/')[1];
    getPostBody(req, (body) => {
      let payload;
      try {
        payload = JSON.parse(body); // Assume JSON
      } catch (e) {
        res.writeHead(400);
        res.end('Invalid payload');
        return;
      }
      const { orderId, sku, quantity, status } = payload;
      if (!sku || !quantity) {
        res.writeHead(400);
        res.end('Missing data');
        return;
      }
      // Update inventory
      if (!data.inventory[sku]) data.inventory[sku] = { quantity: 0 };
      if (status === 'completed') {
        data.inventory[sku].quantity -= parseInt(quantity);
        data.sales.push({ orderId, sku, quantity, platform, timestamp: new Date().toISOString() });
      } else if (status === 'refunded') {
        data.inventory[sku].quantity += parseInt(quantity);
      }
      // Update last sync
      const conn = data.connections.find(c => c.platform === platform);
      if (conn) conn.lastSync = new Date().toISOString();
      saveData();
      res.writeHead(200);
      res.end('Sync processed');
    });
    return;
  }

  // Toggle sync
  if (pathname === '/api/toggle' && method === 'POST') {
    getPostBody(req, (body) => {
      const { platform } = querystring.parse(body);
      const conn = data.connections.find(c => c.platform === platform);
      if (conn) {
        conn.syncEnabled = !conn.syncEnabled;
        saveData();
        res.writeHead(200);
        res.end('Sync toggled to ' + conn.syncEnabled);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    return;
  }

  // Manual sync now (simulate)
  if (pathname === '/api/sync-now' && method === 'POST') {
    getPostBody(req, (body) => {
      const { platform } = querystring.parse(body);
      const conn = data.connections.find(c => c.platform === platform);
      if (conn) {
        conn.lastSync = new Date().toISOString();
        saveData();
        res.writeHead(200);
        res.end('Manual sync done');
      }
    });
    return;
  }

  // Disconnect
  if (pathname === '/api/disconnect' && method === 'POST') {
    getPostBody(req, (body) => {
      const { platform } = querystring.parse(body);
      data.connections = data.connections.filter(c => c.platform !== platform);
      saveData();
      res.writeHead(200);
      res.end('Disconnected');
    });
    return;
  }

  // 404
  res.writeHead(404);
  res.end('Not Found');
});

// Helper to serve file
function serveFile(res, path) {
  if (fs.existsSync('.' + path)) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync('.' + path));
  } else {
    res.writeHead(404);
    res.end('File not found');
  }
}

// Helper to get POST body
function getPostBody(req, callback) {
  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', () => callback(body));
}

// Start server
server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});