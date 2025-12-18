const express = require('express');
const { webhookSchema, validate } = require('../lib/validation');
const {
  adjustInventoryOnOrder,
  updateConnection,
  findConnectionByPlatform,
} = require('../services/integrationService');

const router = express.Router();

// POST /webhook/:platform
router.post('/:platform', async (req, res, next) => {
  try {
    const { platform } = req.params;
    const body = validate(webhookSchema, req.body);

    await adjustInventoryOnOrder({
      sku: body.sku,
      quantity: body.quantity,
      platform,
      status: body.status,
      orderId: body.orderId,
    });

    const conn = await findConnectionByPlatform(platform);
    if (conn) {
      await updateConnection(platform, { lastSync: new Date() });
    }

    res.send('Sync processed');
  } catch (err) {
    if (err instanceof SyntaxError) {
      return res.status(400).send('Invalid payload');
    }
    next(err);
  }
});

module.exports = router;


