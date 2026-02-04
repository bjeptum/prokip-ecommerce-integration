const express = require('express');

const router = express.Router();

router.all('*', (req, res) => {
  res.status(410).json({
    success: false,
    message: 'Bidirectional sync routes disabled. Use /api/ecom/sync-orders.'
  });
});

module.exports = router;
