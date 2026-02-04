const express = require('express');

const router = express.Router();

router.all('*', (req, res) => {
  res.status(410).json({
    success: false,
    message: 'Setup routes disabled. Use /api/ecom/* endpoints.'
  });
});

module.exports = router;
