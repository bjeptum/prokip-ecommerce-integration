const express = require('express');
const {
  createConnection,
} = require('../services/integrationService');

const router = express.Router();

// GET /connect/:platform
router.get('/:platform', async (req, res, next) => {
  try {
    const { platform } = req.params;
    const location = req.query.location || 'default';
    const token = 'fake_token_' + platform;
    const storeName =
      platform.charAt(0).toUpperCase() + platform.slice(1) + ' Store';

    await createConnection({
      platform,
      storeName,
      token,
      locationId: location,
    });

    res.redirect('/setup?platform=' + platform);
  } catch (err) {
    next(err);
  }
});

module.exports = router;


