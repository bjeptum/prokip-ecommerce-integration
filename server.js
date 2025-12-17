const http = require('http');
const fs = require('fs');
const url = require('url');
const querystring = require('querystring');
const { Pool } = require('pg');

// === PostgreSQL Configuration ===
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'prokip_integration',
  password: 'prokip123',  // CHANGE THIS to your password
  port: 5432,
});

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  client.query('SELECT NOW()', (err, result) => {
    release();
    if (err) {
      console.error('Error executing query', err.stack);
    } else {
      console.log('PostgreSQL connected successfully:', result.rows[0]);
    }
  });
});

// Create server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Serve static files
  if (pathname.startsWith('/public/')) {
    const filePath = '.' + pathname;
    if (fs.existsSync(filePath)) {
      const contentType = filePath.endsWith('.css') ? 'text/css' : 'text/html';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(fs.readFileSync(filePath));
      return;
    }
  }

  if (pathname === '/' || pathname === '/index.html') {
    serveFile(res, '/public/index.html');
    return;
  }

  if (pathname === '/setup') {
    serveFile(res, '/public/setup.html');
    return;
  }

  // API: Get connections
  if (pathname === '/api/connections' && method === 'GET') {
    try {
      const result = await pool.query('SELECT * FROM connections');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.rows));
    } catch (err) {
      console.error(err);
      res.writeHead(500);
      res.end('DB Error');
    }
    return;
  }

  // Connect platform
  if (pathname.startsWith('/connect/') && method === 'GET') {
    const platform = pathname.split('/connect/')[1];
    const token = 'fake_token_' + platform;
    const storeName = platform.charAt(0).toUpperCase() + platform.slice(1) + ' Store';
    const locationId = parsedUrl.query.location || 'default';

    await pool.query(
      `INSERT INTO connections (platform, store_name, token, status, last_sync, sync_enabled, location_id)
       VALUES ($1, $2, $3, 'connected', NOW(), TRUE, $4)
       ON CONFLICT DO NOTHING`,
      [platform, storeName, token, locationId]
    );

    res.writeHead(302, { Location: '/setup?platform=' + platform });
    res.end();
    return;
  }

  // Setup choice
  if (pathname === '/api/setup' && method === 'POST') {
    const body = await getPostBody(req);
    const { platform, choice } = querystring.parse(body);
    await pool.query('UPDATE connections SET choice = $1 WHERE platform = $2', [choice, platform]);
    res.writeHead(200);
    res.end('Setup choice saved: ' + choice);
    return;
  }

  // Pull products (fake data → could fetch from real API later)
  if (pathname === '/api/pull' && method === 'POST') {
    const matches = [
      { sku: 'shirt1', name: 'T-Shirt', price: 20, quantity: 100, status: 'matched' },
      { sku: 'pants1', name: 'Pants', price: 30, quantity: 50, status: 'needs_attention' }
    ];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(matches));
    return;
  }

  // Push products
  if (pathname === '/api/push' && method === 'POST') {
    const body = await getPostBody(req);
    const parsed = querystring.parse(body);
    const products = [
      { sku: 'shirt1', name: 'T-Shirt', price: parsed.price_shirt1 || 20, image: parsed.image_shirt1 || '' }
    ];

    for (const p of products) {
      const ready = p.name && p.sku && p.price && p.image;
      if (ready) {
        await pool.query(
          `INSERT INTO inventory (sku, name, quantity, price, image_url)
           VALUES ($1, $2, 100, $3, $4)
           ON CONFLICT (sku) DO UPDATE SET quantity = inventory.quantity`,
          [p.sku, p.name, p.price, p.image]
        );
      }
      p.ready = ready;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(products));
    return;
  }

  // Webhook sync
  if (pathname.startsWith('/webhook/') && method === 'POST') {
    const platform = pathname.split('/webhook/')[1];
    const body = await getPostBody(req);
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (e) {
      res.writeHead(400); res.end('Invalid JSON'); return;
    }

    const { orderId, sku, quantity, status } = payload;
    if (!sku || !quantity) { res.writeHead(400); res.end('Missing data'); return; }

    await pool.query('BEGIN');

    if (status === 'completed') {
      await pool.query('UPDATE inventory SET quantity = quantity - $1 WHERE sku = $2', [quantity, sku]);
      await pool.query(
        'INSERT INTO sales_logs (order_id, sku, quantity, platform, status) VALUES ($1, $2, $3, $4, $5)',
        [orderId, sku, quantity, platform, status]
      );
    } else if (status === 'refunded') {
      await pool.query('UPDATE inventory SET quantity = quantity + $1 WHERE sku = $2', [quantity, sku]);
    }

    await pool.query('UPDATE connections SET last_sync = NOW() WHERE platform = $1', [platform]);
    await pool.query('COMMIT');

    res.writeHead(200);
    res.end('Sync processed');
    return;
  }

  // Controls: toggle, sync-now, disconnect
  if (pathname === '/api/toggle' && method === 'POST') {
    const body = await getPostBody(req);
    const { platform } = querystring.parse(body);
    const result = await pool.query('UPDATE connections SET sync_enabled = NOT sync_enabled WHERE platform = $1 RETURNING sync_enabled', [platform]);
    res.writeHead(200);
    res.end('Sync toggled to ' + result.rows[0].sync_enabled);
    return;
  }

  if (pathname === '/api/sync-now' && method === 'POST') {
    const body = await getPostBody(req);
    const { platform } = querystring.parse(body);
    await pool.query('UPDATE connections SET last_sync = NOW() WHERE platform = $1', [platform]);
    res.writeHead(200);
    res.end('Manual sync done');
    return;
  }

  if (pathname === '/api/disconnect' && method === 'POST') {
    const body = await getPostBody(req);
    const { platform } = querystring.parse(body);
    await pool.query('DELETE FROM connections WHERE platform = $1', [platform]);
    res.writeHead(200);
    res.end('Disconnected');
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

function serveFile(res, path) {
  if (fs.existsSync('.' + path)) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync('.' + path));
  } else {
    res.writeHead(404);
    res.end('File not found');
  }
}

function getPostBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
  });
}

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
  console.log('PostgreSQL integration active!');
});