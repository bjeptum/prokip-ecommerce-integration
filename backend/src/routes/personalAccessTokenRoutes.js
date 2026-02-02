const express = require('express');
const jwt = require('jsonwebtoken');
const PersonalAccessTokenService = require('../services/personalAccessTokenService');

const router = express.Router();
const patService = new PersonalAccessTokenService();

// Middleware to authenticate JWT token (from login)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId || decoded.id;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
const authenticatePAT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Personal Access Token required' });
    }

    const token = authHeader.split(' ')[1];
    const tokenValidation = await patService.validateToken(token);
    
    if (!tokenValidation.success) {
      return res.status(401).json({ error: tokenValidation.error });
    }
    
    // Attach token info to request
    req.pat = tokenValidation.data;
    req.userId = tokenValidation.data.userId;
    req.connectionId = tokenValidation.data.connectionId;
    
    next();
  } catch (error) {
    console.error('❌ PAT authentication error:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Generate a new Personal Access Token
 */
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { name, connectionId } = req.body;
    
    if (!connectionId) {
      return res.status(400).json({ error: 'Connection ID is required' });
    }
    
    const result = await patService.generateToken(
      req.userId,
      connectionId,
      name || 'WooCommerce Integration'
    );
    
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(400).json({ error: result.error });
    }
    
  } catch (error) {
    console.error('❌ Failed to generate token:', error.message);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

/**
 * List all Personal Access Tokens for the user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await patService.listTokens(req.userId);
    
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(400).json({ error: result.error });
    }
    
  } catch (error) {
    console.error('❌ Failed to list tokens:', error.message);
    res.status(500).json({ error: 'Failed to list tokens' });
  }
});

/**
 * Revoke a Personal Access Token
 */
router.delete('/:tokenId', authenticateToken, async (req, res) => {
  try {
    const { tokenId } = req.params;
    
    const result = await patService.revokeToken(tokenId, req.userId);
    
    if (result.success) {
      res.json({ message: result.message });
    } else {
      res.status(400).json({ error: result.error });
    }
    
  } catch (error) {
    console.error('❌ Failed to revoke token:', error.message);
    res.status(500).json({ error: 'Failed to revoke token' });
  }
});

/**
 * Test endpoint protected by PAT
 */
router.get('/test', authenticatePAT, async (req, res) => {
  try {
    res.json({
      message: 'Personal Access Token authentication successful',
      user: {
        userId: req.pat.userId,
        connectionId: req.pat.connectionId,
        tokenName: req.pat.tokenName
      }
    });
  } catch (error) {
    console.error('❌ PAT test error:', error.message);
    res.status(500).json({ error: 'Test failed' });
  }
});

module.exports = router;
