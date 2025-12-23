const express = require('express');
const { pollProkipToStores } = require('../services/syncService');

const router = express.Router();

router.post('/', async (req, res) => {
  await pollProkipToStores();
  res.json({ success: true, message: 'Manual sync triggered' });
});

module.exports = router;
