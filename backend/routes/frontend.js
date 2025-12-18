const path = require('path');
const express = require('express');

const router = express.Router();

// Root dashboard
router.get(['/', '/index.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'index.html'));
});

// Setup page
router.get('/setup', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'setup.html'));
});

module.exports = router;


