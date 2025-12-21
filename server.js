require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const OAuth = require('oauth').OAuth;

const app = express();
const prisma = new PrismaClient();

app.use(bodyParser.json());
app.use(bodyParser.raw({ type: 'application/json' })); // For webhooks
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

// Helper to get Prokip config (token, apiUrl)
async function getProkipConfig() {
  return await prisma.prokipConfig.findUnique({ where: { id: 1 } });
}

// Route for dashboard
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Login to Prokip
app.post('/login/prokip', async (req, res) => {
  const { username, password } = req.body;
  try {
    const response = await axios.post(`${process.env.PROKIP_API}/login`, { username, password });
    const token = response.data.token;
    await prisma.prokipConfig.upsert({
      where: { id: 1 },
      update: { token },
      create: { id: 1, token, apiUrl: process.env.PROKIP_API },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Prokip login failed. Check username/password.' });
  }
});

// Connect Shopify
app.get('/connect/shopify', async (req, res) => {
  const { store } = req.query;
  if (!store) return res.status(400).json({ error: 'Store URL required (e.g., mystore.myshopify.com)' });
  const state = crypto.randomBytes(16).toString('hex');
  // Todo: Store state in session for verification (use express-session for production)
  const scopes = 'read_products,write_products,read_inventory,write_inventory,read_orders,write_orders';
  const redirectUri = process.env.REDIRECT_URI || `http://localhost:${PORT}/callback/shopify`;
  const authorizeUrl = `https://${store}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_CLIENT_ID}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;
  res.redirect(authorizeUrl);
});

// Shopify callback
app.get('/callback/shopify', async (req, res) => {
  const { code, shop, state, hmac } = req.query;
  // Todo: Verify state and hmac for security
  try {
    const accessTokenUrl = `https://${shop}/admin/oauth/access_token`;
    const response = await axios.post(accessTokenUrl, {
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      code,
    });
    const accessToken = response.data.access_token;
    await prisma.connection.create({
      data: { platform: 'shopify', storeUrl: shop, accessToken },
    });
    await registerShopifyWebhooks(shop, accessToken);
    res.redirect('/?success=Connected to Shopify!');
  } catch (error) {
    res.status(500).send('Shopify connection failed. Try again.');
  }
});

// Register Shopify webhooks
async function registerShopifyWebhooks(shop, accessToken) {
  const webhookUrl = process.env.WEBHOOK_URL || `http://localhost:${PORT}/webhook/shopify`;
  const topics = ['orders/create', 'orders/updated', 'orders/cancelled', 'products/update'];
  for (const topic of topics) {
    await axios.post(`https://${shop}/admin/api/2024-01/webhooks.json`, {
      webhook: { topic, address: webhookUrl, format: 'json' },
    }, { headers: { 'X-Shopify-Access-Token': accessToken } });
  }
}

// Shopify webhook
app.post('/webhook/shopify', (req, res) => {
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const topic = req.headers['x-shopify-topic'];
  const shop = req.headers['x-shopify-shop-domain'];
  const generatedHmac = crypto.createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET).update(req.body).digest('base64');
  if (generatedHmac !== hmac) return res.status(401).send('Invalid webhook');
  const data = JSON.parse(req.body);
  // Process: e.g., if topic === 'orders/create', record in Prokip
  processStoreToProkip(shop, topic, data);
  res.status(200).send();
});

// Connect WooCommerce (using POST with keys)
app.post('/connect/woocommerce', async (req, res) => {
  const { storeUrl, consumerKey, consumerSecret } = req.body;
  try {
    await prisma.connection.create({
      data: { platform: 'woocommerce', storeUrl, consumerKey, consumerSecret },
    });
    await registerWooWebhooks(storeUrl, consumerKey, consumerSecret);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'WooCommerce connection failed. Check keys.' });
  }
});

// Register Woo webhooks
async function registerWooWebhooks(storeUrl, consumerKey, consumerSecret) {
  const webhookUrl = process.env.WEBHOOK_URL || `http://localhost:${PORT}/webhook/woocommerce`;
  const oa = new OAuth(
    `${storeUrl}/wp-json/wc/v3`, // request url (not used)
    `${storeUrl}/wp-json/wc/v3`, // access url (not used)
    consumerKey,
    consumerSecret,
    '1.0A',
    null,
    'HMAC-SHA1'
  );
  const topics = ['order.created', 'order.updated', 'order.deleted', 'product.updated'];
  for (const topic of topics) {
    oa.post(`${storeUrl}/wp-json/wc/v3/webhooks`, null, null, {
      name: topic,
      topic,
      delivery_url: webhookUrl,
    }, 'json', (error, data) => {
      if (error) console.error(error);
      // Data has secret, store in DB if needed
    });
  }
}

// Woo webhook
app.post('/webhook/woocommerce', (req, res) => {
  // Woo webhooks have no standard header hmac, but if plugin adds, verify
  // Assume secret stored per webhook, but for simple, no verification
  const data = req.body;
  const topic = data.argument; // or from payload
  // Find connection by storeUrl from payload
  // Process
  processStoreToProkip(storeUrl, topic, data);
  res.status(200).send();
});

// Helper to process store to Prokip (record sale, update inventory)
async function processStoreToProkip(storeUrl, topic, data) {
  const prokip = await getProkipConfig();
  if (!prokip) return;
  const connection = await prisma.connection.findFirst({ where: { storeUrl } });
  if (!connection) return;
  if (topic.includes('order.create') || topic.includes('order.paid')) {
    // Extract order data: sku, quantity, etc.
    // Example for Shopify/Woo unified
    const items = data.line_items || data.line_items; // adjust
    for (const item of items) {
      await axios.patch(`${prokip.apiUrl}/inventory`, { sku: item.sku, quantity: -item.quantity }, {
        headers: { Authorization: `Bearer ${prokip.token}` },
      });
    }
    await axios.post(`${prokip.apiUrl}/sales`, { orderId: data.id, items, total: data.total }, {
      headers: { Authorization: `Bearer ${prokip.token}` },
    });
  } else if (topic.includes('order.cancelled') || topic.includes('order.refunded')) {
    // Restore inventory
  }
  // Update lastSync
  await prisma.connection.update({ where: { id: connection.id }, data: { lastSync: new Date() } });
}

// Product setup (pull or push)
app.post('/setup/products', async (req, res) => {
  const { method, connectionId } = req.body; // pull or push
  const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
  const prokip = await getProkipConfig();
  if (!connection || !prokip) return res.status(400).json({ error: 'Invalid connection' });
  if (method === 'pull') {
    // Pull from store to Prokip
    const products = await fetchProductsFromStore(connection);
    for (const product of products) {
      // Match by SKU, update or create in Prokip
      await axios.post(`${prokip.apiUrl}/products`, product, { headers: { Authorization: `Bearer ${prokip.token}` } });
    }
  } else if (method === 'push') {
    // Push from Prokip to store
    const prokipProducts = await axios.get(`${prokip.apiUrl}/products`, { headers: { Authorization: `Bearer ${prokip.token}` } });
    for (const product of prokipProducts.data) {
      if (!product.name || !product.sku || !product.price) continue; // Check readiness
      await createProductInStore(connection, product);
    }
  }
  res.json({ success: true });
});

// Helper to fetch products from store
async function fetchProductsFromStore(connection) {
  if (connection.platform === 'shopify') {
    const response = await axios.get(`https://${connection.storeUrl}/admin/api/2024-01/products.json`, {
      headers: { 'X-Shopify-Access-Token': connection.accessToken },
    });
    return response.data.products.map(p => ({ sku: p.variants[0].sku, name: p.title, price: p.variants[0].price })); // Simplify
  } else if (connection.platform === 'woocommerce') {
    const oa = new OAuth(/* params as above */);
    return new Promise((resolve, reject) => {
      oa.get(`${connection.storeUrl}/wp-json/wc/v3/products`, null, null, (error, data) => {
        if (error) reject(error);
        const products = JSON.parse(data);
        resolve(products.map(p => ({ sku: p.sku, name: p.name, price: p.price })));
      });
    });
  }
}

// Helper to create product in store
async function createProductInStore(connection, product) {
  if (connection.platform === 'shopify') {
    await axios.post(`https://${connection.storeUrl}/admin/api/2024-01/products.json`, { product }, {
      headers: { 'X-Shopify-Access-Token': connection.accessToken },
    });
  } else if (connection.platform === 'woocommerce') {
    const oa = new OAuth(/* ... */);
    oa.post(`${connection.storeUrl}/wp-json/wc/v3/products`, null, null, product, 'json', (error) => {
      if (error) console.error(error);
    });
  }
}

// Manual sync
app.post('/sync', async (req, res) => {
  // Trigger poll
  await pollProkipToStores();
  res.json({ success: true });
});

// Disconnect
app.post('/disconnect', async (req, res) => {
  const { connectionId } = req.body;
  await prisma.connection.delete({ where: { id: connectionId } });
  res.json({ success: true });
});

// Get status
app.get('/status', async (req, res) => {
  const connections = await prisma.connection.findMany();
  res.json(connections);
});

// Periodic poll for Prokip -> Store (every 5 min)
cron.schedule('*/5 * * * *', async () => {
  await pollProkipToStores();
});

async function pollProkipToStores() {
  const prokip = await getProkipConfig();
  if (!prokip) return;
  const inventory = await axios.get(`${prokip.apiUrl}/inventory`, { headers: { Authorization: `Bearer ${prokip.token}` } });
  const connections = await prisma.connection.findMany();
  for (const conn of connections) {
    const caches = await prisma.inventoryCache.findMany({ where: { connectionId: conn.id } });
    for (const item of inventory.data) {
      const cache = caches.find(c => c.sku === item.sku);
      if (cache && cache.quantity !== item.quantity) {
        // Update store
        await updateInventoryInStore(conn, item.sku, item.quantity);
        // Update cache
        await prisma.inventoryCache.update({ where: { id: cache.id }, data: { quantity: item.quantity } });
      } else if (!cache) {
        // Create cache
        await prisma.inventoryCache.create({ data: { connectionId: conn.id, sku: item.sku, quantity: item.quantity } });
      }
    }
  }
}

// Helper to update inventory in store
async function updateInventoryInStore(connection, sku, quantity) {
  // Similar to create, find product/variant by sku, update inventory
  // Implement for shopify/woo using API
  // Example for shopify: Find variant id, then POST /admin/api/2024-01/inventory_levels/set.json
  // For woo: PUT /products/{id} with stock_quantity
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));