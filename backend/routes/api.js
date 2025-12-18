const express = require('express');
const {
  setupSchema,
  platformBodySchema,
  pushSchema,
  validate,
} = require('../lib/validation');
const {
  listConnections,
  updateConnection,
  deleteConnection,
} = require('../services/integrationService');

const router = express.Router();

// GET /api/connections
router.get('/connections', async (req, res, next) => {
  try {
    const connections = await listConnections();
    res.json(connections);
  } catch (err) {
    next(err);
  }
});

// POST /api/setup
router.post('/setup', async (req, res, next) => {
  try {
    const body = validate(setupSchema, req.body);
    const conn = await updateConnection(body.platform, { choice: body.choice });
    if (!conn) {
      return res.status(404).send('Connection not found');
    }
    res.type('text/plain').send('Setup choice saved: ' + body.choice);
  } catch (err) {
    next(err);
  }
});

// POST /api/pull
router.post('/pull', async (req, res, next) => {
  try {
    validate(platformBodySchema, req.body);
    // Fake fetch products from store
    const storeProducts = [
      { sku: 'shirt1', name: 'T-Shirt', price: 20, quantity: 100 },
      { sku: 'pants1', name: 'Pants', price: 30, quantity: 50 },
    ];
    // Fake Prokip products
    const prokipProducts = { shirt1: { quantity: 90 } }; // Partial match
    // Match by SKU
    const matches = storeProducts.map((p) => ({
      ...p,
      status: prokipProducts[p.sku] ? 'matched' : 'needs_attention',
    }));
    res.json(matches);
  } catch (err) {
    next(err);
  }
});

// POST /api/push
router.post('/push', async (req, res, next) => {
  try {
    const body = validate(pushSchema, req.body);
    // Fake Prokip products
    let products = [
      {
        sku: 'shirt1',
        name: 'T-Shirt',
        price: body.price_shirt1 || 20,
        image: body.image_shirt1 || '',
        quantity: 100,
      },
    ];
    // Check readiness
    products = products.map((p) => ({
      ...p,
      ready: p.name && p.sku && p.price && p.image ? true : false,
    }));
    res.json(products);
  } catch (err) {
    next(err);
  }
});

// POST /api/toggle
router.post('/toggle', async (req, res, next) => {
  try {
    const body = validate(platformBodySchema, req.body);
    const existing = await listConnections();
    const conn = existing.find((c) => c.platform === body.platform);
    if (!conn) {
      return res.status(404).send('Not found');
    }
    const updated = await updateConnection(body.platform, {
      syncEnabled: !conn.syncEnabled,
    });
    res.send('Sync toggled to ' + updated.syncEnabled);
  } catch (err) {
    next(err);
  }
});

// POST /api/sync-now
router.post('/sync-now', async (req, res, next) => {
  try {
    const body = validate(platformBodySchema, req.body);
    const existing = await listConnections();
    const conn = existing.find((c) => c.platform === body.platform);
    if (!conn) {
      return res.status(404).send('Not found');
    }
    await updateConnection(body.platform, { lastSync: new Date() });
    res.send('Manual sync done');
  } catch (err) {
    next(err);
  }
});

// POST /api/disconnect
router.post('/disconnect', async (req, res, next) => {
  try {
    const body = validate(platformBodySchema, req.body);
    await deleteConnection(body.platform);
    res.send('Disconnected');
  } catch (err) {
    next(err);
  }
});

// Error handler for this router
router.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  res.status(status).send(err.message || 'Internal Server Error');
});

module.exports = router;


