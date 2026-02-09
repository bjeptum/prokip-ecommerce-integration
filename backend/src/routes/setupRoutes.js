const express = require('express');
const axios = require('axios');

const authMiddleware = require('../middlewares/authMiddleware');
const prisma = require('../lib/prisma');
const { getWooProducts, getWooBaseUrl, testWooConnection } = require('../services/wooService');
const wooSecureService = require('../services/wooSecureService');
const { getShopifyProducts, createShopifyProduct } = require('../services/shopifyService');
const prokipService = require('../services/prokipService');
const prokipEcomClient = require('../services/prokipEcomClient');

const router = express.Router();

// Require auth for every setup route
router.use(authMiddleware);

async function resolveConnection(connectionId, userId) {
  const id = parseInt(connectionId, 10);
  if (Number.isNaN(id)) return null;
  return prisma.connection.findFirst({
    where: { id, userId }
  });
}

function decryptIfNeeded(raw) {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed && parsed.encrypted) {
      return wooSecureService.decrypt(parsed);
    }
  } catch (err) {
    // fall back to plain text
  }
  return raw;
}

function getWooCredentials(connection) {
  const consumerKey = decryptIfNeeded(connection.consumerKey);
  const consumerSecret = decryptIfNeeded(connection.consumerSecret);
  const wooUsername = connection.wooUsername || null;
  const wooAppPassword = decryptIfNeeded(connection.wooAppPassword);

  return { consumerKey, consumerSecret, wooUsername, wooAppPassword };
}

async function fetchStoreProducts(connection) {
  if (connection.platform === 'woocommerce') {
    const { consumerKey, consumerSecret, wooUsername, wooAppPassword } = getWooCredentials(connection);
    return getWooProducts(
      connection.storeUrl,
      consumerKey,
      consumerSecret,
      connection.oauthToken,
      connection.oauthSecret,
      wooUsername,
      wooAppPassword,
      { per_page: 100 }
    );
  }

  if (connection.platform === 'shopify') {
    return getShopifyProducts(connection.storeUrl, connection.accessToken);
  }

  throw new Error(`Unsupported platform: ${connection.platform}`);
}

async function fetchProkipProducts(userId) {
  return prokipService.getProducts(null, userId);
}

function normaliseSku(value) {
  return (value || '').toString().trim().toLowerCase();
}

function mapStoreProductToBasic(product, platform) {
  if (platform === 'woocommerce') {
    return {
      id: product.id,
      name: product.name,
      sku: product.sku || product.id?.toString(),
      price: Number.parseFloat(product.price || product.regular_price || 0) || 0,
      stock: Number.parseFloat(product.stock_quantity ?? 0) || 0
    };
  }

  // Shopify
  const variant = product.variants?.[0] || {};
  return {
    id: product.id,
    name: product.title,
    sku: variant.sku || product.id?.toString(),
    price: Number.parseFloat(variant.price || 0) || 0,
    stock: Number.parseFloat(variant.inventory_quantity ?? 0) || 0
  };
}

function mapProkipProductToBasic(product) {
  return {
    id: product.id || product.product_id || product.productID,
    name: product.name || product.product_name,
    sku: product.sku || product.product_sku || product.code,
    price:
      Number.parseFloat(
        product.sell_price_inc_tax ||
          product.price ||
          product.unit_price ||
          product.selling_price ||
          0
      ) || 0,
    stock: Number.parseFloat(product.qty_available ?? product.quantity ?? 0) || 0,
    image: product.image_url || product.image || null
  };
}

router.get('/products/matches', async (req, res) => {
  try {
    const { connectionId } = req.query;
    const connection = await resolveConnection(connectionId, req.userId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const [storeRaw, prokipRaw] = await Promise.all([
      fetchStoreProducts(connection),
      fetchProkipProducts(req.userId)
    ]);

    const store = (storeRaw || []).map((p) => mapStoreProductToBasic(p, connection.platform));
    const prokip = (prokipRaw || []).map(mapProkipProductToBasic);

    const storeMap = new Map(store.map((p) => [normaliseSku(p.sku), p]));
    const prokipMap = new Map(prokip.map((p) => [normaliseSku(p.sku), p]));

    const matches = [];
    const unmatchedProkip = [];
    const unmatchedStore = [];

    prokip.forEach((p) => {
      const key = normaliseSku(p.sku);
      if (key && storeMap.has(key)) {
        matches.push({ sku: p.sku, prokipProduct: p, storeProduct: storeMap.get(key) });
      } else {
        unmatchedProkip.push(p);
      }
    });

    store.forEach((p) => {
      const key = normaliseSku(p.sku);
      if (!key || !prokipMap.has(key)) {
        unmatchedStore.push(p);
      }
    });

    res.json({
      success: true,
      matches,
      unmatched: {
        prokip: unmatchedProkip,
        store: unmatchedStore
      }
    });
  } catch (error) {
    console.error('Product matching failed:', error);
    res.status(500).json({ error: 'Failed to build product matches', details: error.message });
  }
});

router.post('/products/readiness-check', async (req, res) => {
  try {
    const { connectionId } = req.body;
    const connection = await resolveConnection(connectionId, req.userId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const prokipRaw = await fetchProkipProducts(req.userId);
    const prokip = (prokipRaw || []).map(mapProkipProductToBasic);

    const products = prokip.map((p) => {
      const issues = [];
      if (!p.name) issues.push('Missing product name');
      if (!p.sku) issues.push('Missing SKU');
      if (p.price <= 0) issues.push('Add a price before publishing');
      if (!p.image) issues.push('Add at least one image');
      return { ...p, issues };
    });

    const ready = products.filter((p) => p.issues.length === 0).length;
    const needsAttention = products.length - ready;

    res.json({
      success: true,
      summary: {
        total: products.length,
        ready,
        needsAttention
      },
      products
    });
  } catch (error) {
    console.error('Readiness check failed:', error);
    res.status(500).json({ error: 'Failed to run readiness check', details: error.message });
  }
});

async function createWooProduct(connection, product) {
  const { consumerKey, consumerSecret, wooUsername, wooAppPassword } = getWooCredentials(connection);
  const baseUrl = `${getWooBaseUrl(connection.storeUrl)}/wp-json/wc/v3/products`;

  const auth =
    wooUsername && wooAppPassword
      ? { username: wooUsername, password: wooAppPassword }
      : { username: consumerKey, password: consumerSecret };

  const payload = {
    name: product.name || 'Product',
    type: 'simple',
    sku: product.sku,
    regular_price: (product.price || 0).toString(),
    manage_stock: true,
    stock_quantity: product.stock ?? 0,
    status: 'publish'
  };

  await axios.post(baseUrl, payload, {
    auth,
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Prokip-Integration/1.0' },
    timeout: 30000
  });
}

router.post('/products', async (req, res) => {
  try {
    const { method, connectionId } = req.body;
    const connection = await resolveConnection(connectionId, req.userId);

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    if (!['pull', 'push'].includes(method)) {
      return res.status(400).json({ error: 'Method must be pull or push' });
    }

    if (method === 'pull') {
      // Delegate to Prokip e-commerce API for store -> Prokip sync
      try {
        const result = await prokipEcomClient.syncProducts({ store_id: connection.id }, req.userId);
        return res.json({ success: true, message: 'Products pulled successfully', result });
      } catch (err) {
        // Fallback: at least fetch products so UI continues gracefully
        const storeProducts = await fetchStoreProducts(connection);
        return res.json({
          success: true,
          message: 'Products pulled (fallback) - unable to reach Prokip API, returning store products only',
          result: { products: storeProducts.length }
        });
      }
    }

    // Push: Prokip -> store
    const readiness = await prokipService.getProducts(null, req.userId);
    const readyProducts = (readiness || [])
      .map(mapProkipProductToBasic)
      .filter(
        (p) => p.name && p.sku && p.price > 0 && p.sku.toString().trim().length > 0
      );

    let created = 0;
    const errors = [];

    for (const product of readyProducts) {
      try {
        if (connection.platform === 'woocommerce') {
          await createWooProduct(connection, product);
        } else if (connection.platform === 'shopify') {
          await createShopifyProduct(connection.storeUrl, connection.accessToken, {
            title: product.name,
            sku: product.sku,
            price: product.price,
            stock_quantity: product.stock
          });
        } else {
          throw new Error(`Unsupported platform: ${connection.platform}`);
        }
        created += 1;
      } catch (err) {
        errors.push({ sku: product.sku, error: err.message });
      }
    }

    res.json({
      success: true,
      message: 'Products published to store',
      created,
      failed: errors.length,
      errors
    });
  } catch (error) {
    console.error('Product setup failed:', error);
    res.status(500).json({ error: 'Product setup failed', details: error.message });
  }
});

// Lightweight connection status helper used by the frontend "sync status" card
router.get('/sync-status/:storeId', async (req, res) => {
  try {
    const connection = await resolveConnection(req.params.storeId, req.userId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    let status = 'connected';
    let message = 'Connection is working';

    if (connection.platform === 'woocommerce') {
      const { consumerKey, consumerSecret, wooUsername, wooAppPassword } = getWooCredentials(connection);
      const test = await testWooConnection(
        connection.storeUrl,
        consumerKey,
        consumerSecret,
        connection.oauthToken,
        connection.oauthSecret,
        wooUsername,
        wooAppPassword
      );
      status = test.success ? 'connected' : 'error';
      message = test.message;
    }

    res.json({
      success: true,
      status,
      message,
      lastSync: connection.lastSync,
      products_synced: await prisma.inventoryLog.count({ where: { connectionId: connection.id } }),
      orders_synced: await prisma.salesLog.count({ where: { connectionId: connection.id } })
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load sync status', details: error.message });
  }
});

module.exports = router;
