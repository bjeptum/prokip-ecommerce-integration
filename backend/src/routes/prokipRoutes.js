const express = require('express');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const prokipService = require('../services/prokipService');
const prokipLocalAuthService = require('../services/prokipLocalAuthService');

const router = express.Router();

// Auth middleware (JWT or Prokip token)
router.use(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    return next();
  } catch (jwtError) {
    try {
      const config = await prisma.prokipConfig.findFirst({ where: { token } });
      if (config) {
        req.userId = config.userId;
        return next();
      }
    } catch (error) {
      // fall through
    }
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
});

router.get('/products', async (req, res) => {
  try {
    const userId = req.userId;
    const config = await prokipService.getProkipConfig(userId);
    const locationId = config?.locationId ? parseInt(config.locationId, 10) : null;

    const useLocal =
      process.env.PROKIP_LOCAL_AUTH === 'true' &&
      config?.apiUrl &&
      config.apiUrl.toString().includes(process.env.PROKIP_BASE_URL || '127.0.0.1');

    if (useLocal) {
      const products = await prokipLocalAuthService.getProducts(locationId);
      return res.json({ success: true, products, locationId });
    }

    const products = await prokipService.getProducts(null, userId);
    res.json({ success: true, products, locationId: config?.locationId || null });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load products' });
  }
});

router.get('/sales', async (req, res) => {
  try {
    const userId = req.userId;
    const config = await prokipService.getProkipConfig(userId);
    const locationId = config?.locationId ? parseInt(config.locationId, 10) : null;

    const useLocal =
      process.env.PROKIP_LOCAL_AUTH === 'true' &&
      config?.apiUrl &&
      config.apiUrl.toString().includes(process.env.PROKIP_BASE_URL || '127.0.0.1');

    if (useLocal) {
      const sales = await prokipLocalAuthService.getSales(locationId);
      return res.json({ success: true, sales, locationId });
    }

    const sales = await prokipService.getSales(null, null, null, userId);
    res.json({ success: true, sales, locationId: config?.locationId || null });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load sales' });
  }
});

router.get('/purchases', async (req, res) => {
  try {
    const userId = req.userId;
    const config = await prokipService.getProkipConfig(userId);
    const locationId = config?.locationId ? parseInt(config.locationId, 10) : null;

    const useLocal =
      process.env.PROKIP_LOCAL_AUTH === 'true' &&
      config?.apiUrl &&
      config.apiUrl.toString().includes(process.env.PROKIP_BASE_URL || '127.0.0.1');

    if (useLocal) {
      const purchases = await prokipLocalAuthService.getPurchases(locationId);
      return res.json({ success: true, purchases, locationId });
    }

    const purchases = await prokipService.getPurchases(null, null, null, userId);
    res.json({ success: true, purchases, locationId: config?.locationId || null });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load purchases' });
  }
});

module.exports = router;
