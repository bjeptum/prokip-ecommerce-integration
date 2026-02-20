const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { body, validationResult } = require('express-validator');
const prokipService = require('../services/prokipService');
const prokipLocalAuthService = require('../services/prokipLocalAuthService');

const router = express.Router();

// Authentication middleware for logout
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // For logout, we allow it without token but will clear all if no token
    return next();
  }

  const token = authHeader.split(' ')[1];

  // Try to verify as JWT first
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.user = decoded;
    return next();
  } catch (jwtError) {
    // If JWT fails, try Prokip token
    // Look for Prokip config by token directly (avoid calling getValidToken without userId)
    prisma.prokipConfig.findFirst({ where: { token } }).then(config => {
      if (config) {
        req.userId = config.userId;
        req.user = { id: config.userId };
        return next();
      }
      return next();
    }).catch(error => {
      console.error('Prokip token validation error:', error);
      return next();
    });
  }
};

router.post('/register', [
  body('username').notEmpty().trim(),
  body('password').isLength({ min: 6 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: { username, password: hashed }
    });
    res.json({ success: true, message: 'User registered' });
  } catch (error) {
    res.status(500).json({ error: 'Username already exists' });
  }
});

router.post('/login', [
  body('username').notEmpty(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
});

/**
 * Prokip Login - Authenticate user with Prokip OAuth API
 * This endpoint gets an access token from Prokip using user credentials and loads real business locations
 */
router.post('/prokip-login', [
  body('username').notEmpty().withMessage('Email is required'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Please enter your Prokip email and password',
      details: errors.array() 
    });
  }

  const { username, password, locationId } = req.body;

  try {
    console.log('🔐 Prokip OAuth login attempt started...');
    console.log('📧 Username:', username);
    console.log('🔑 Password provided:', password ? '✅ Yes' : '❌ No');

    // Attach Prokip to local user if JWT provided
    let localUser = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const localToken = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(localToken, process.env.JWT_SECRET);
        localUser = await prisma.user.findUnique({ where: { id: decoded.id } });
      } catch (error) {
        // fall back to legacy behavior
      }
    }

    const useLocalProkip = process.env.PROKIP_LOCAL_AUTH === 'true';

    let access_token;
    let refresh_token;
    let expires_in;
    let locations = [];

    let usedLocal = false;

    if (useLocalProkip) {
      try {
        const authResult = await prokipLocalAuthService.authenticateUser(username, password);
        if (authResult.success) {
          const prokipUser = authResult.user;
          locations = await prokipLocalAuthService.getBusinessLocations(prokipUser.business_id);
          access_token = process.env.PROKIP_ECOM_TOKEN || 'local-token';
          refresh_token = null;
          expires_in = 86400;
          usedLocal = true;
        } else {
          console.warn('⚠️ Local Prokip auth failed, attempting remote OAuth...', authResult.error);
        }
      } catch (localErr) {
        console.warn('⚠️ Local Prokip DB auth error, falling back to remote OAuth:', localErr.message);
      }
    }

    if (!usedLocal) {
      // Authenticate with Prokip OAuth API (real method)
      const tokenData = await prokipService.authenticateUser(username, password);
      access_token = tokenData.access_token;
      refresh_token = tokenData.refresh_token;
      expires_in = tokenData.expires_in;

      // Get real business locations using the OAuth token
      locations = await prokipService.getBusinessLocations(access_token);
    }
    
    console.log('✅ Prokip OAuth authentication successful!');
    console.log('📦 Access token received:', access_token ? 'present' : 'missing');
    
    console.log('📍 Real business locations loaded:', locations.length);
    locations.forEach((location, index) => {
      console.log(`  ${index + 1}. ${location.name || location.id} (ID: ${location.id})`);
    });

    // Create or find user in our system
    let user = localUser || await prisma.user.findUnique({
      where: { username }
    });
    
    if (!user) {
      // Create a new user if doesn't exist
      const hashedPassword = await bcrypt.hash(password, 10);
      user = await prisma.user.create({
        data: {
          username,
          password: hashedPassword
        }
      });
      console.log('✅ Created new user:', username);
    }

    // Store Prokip config using OAuth token
    const defaultApiUrl =
      process.env.PROKIP_API ||
      process.env.PROKIP_BASE_URL ||
      'https://api.prokip.africa';
    const apiUrl = (useLocalProkip && usedLocal)
      ? (process.env.PROKIP_BASE_URL || defaultApiUrl)
      : defaultApiUrl;

    await prisma.prokipConfig.upsert({
      where: { userId: user.id },
      update: {
        token: access_token,
        refreshToken: refresh_token,
        expiresAt: new Date(Date.now() + (expires_in * 1000)),
        apiUrl,
        locationId: locationId || (locations.length > 0 ? locations[0].id.toString() : '1')
      },
      create: {
        userId: user.id,
        token: access_token,
        refreshToken: refresh_token,
        expiresAt: new Date(Date.now() + (expires_in * 1000)),
        apiUrl,
        locationId: locationId || (locations.length > 0 ? locations[0].id.toString() : '1')
      }
    });

    // Generate JWT token for our system
    const jwtToken = jwt.sign(
      { 
        id: user.id, 
        username: user.username,
        prokipConnectionId: user.id
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      success: true,
      message: 'Login successful',
      token: jwtToken,
      access_token: access_token, // OAuth token for frontend
      refresh_token: refresh_token,
      expires_in: expires_in,
      user: {
        id: user.id,
        username: user.username
      },
      locations: locations, // Real business locations only
      prokipConnection: {
        connectionId: user.id,
        user: user,
        tokenType: 'oauth',
        expiresAt: new Date(Date.now() + (expires_in * 1000))
      }
    });

  } catch (error) {
    console.error('❌ Prokip OAuth login error in auth route:');
    console.error('   Error message:', error.message);
    console.error('   Error response:', error.response?.data);
    console.error('   Error status:', error.response?.status);
    console.error('   Error code:', error.code);
    
    const msg = error.message || '';
    const upstreamStatus = error.response?.status;
    let status = 500;

    if (msg.includes('Invalid Prokip credentials')) {
      status = 401;
    } else if (msg.includes('Invalid Prokip OAuth client configuration')) {
      status = 500;
    } else if (upstreamStatus && upstreamStatus >= 400 && upstreamStatus < 500) {
      status = 400;
    }

    res.status(status).json({
      error: msg || 'Prokip login failed.',
      message: msg || 'Prokip login failed.',
      upstreamStatus: upstreamStatus || null,
      details: error.response?.data || null
    });
  }
});

/**
 * Set Prokip business location
 * After login, user selects a location to work with
 * Also creates/finds a local user and returns a JWT for API authentication
 */
router.post('/prokip-location', [
  body('locationId').notEmpty().withMessage('Location is required'),
  body('access_token').notEmpty().withMessage('Token is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Please select a business location',
      details: errors.array() 
    });
  }

  const { locationId, access_token, refresh_token, expires_in, username } = req.body;

  console.log('🔍 Prokip location save attempt:');
  console.log('  - locationId:', locationId);
  console.log('  - access_token length:', access_token ? access_token.length : 'null');
  console.log('  - access_token preview:', access_token ? access_token.substring(0, 50) + '...' : 'null');
  console.log('  - refresh_token present:', !!refresh_token);
  console.log('  - expires_in:', expires_in);

  try {
    // Prefer existing local user if authenticated
    let user = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const localToken = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(localToken, process.env.JWT_SECRET);
        user = await prisma.user.findUnique({ where: { id: decoded.id } });
      } catch (error) {
        // fall back to legacy behavior
      }
    }

    if (!user) {
      // Legacy flow: create or find user based on locationId
      const uniqueUsername = `prokip_${locationId}`;
      user = await prisma.user.findUnique({ where: { username: uniqueUsername } });
      
      if (!user) {
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(`prokip_${locationId}_${Date.now()}`, 10);
        user = await prisma.user.create({
          data: {
            username: uniqueUsername,
            password: hashedPassword
          }
        });
      }
    }

    // Save Prokip config with the correct userId
    await prokipService.saveProkipConfig({
      access_token,
      refresh_token: refresh_token || null,
      expires_in: expires_in || 86400, // Default 24 hours
      locationId
    }, user.id);

    // Generate JWT token for the user to use in subsequent API calls
    const jwtToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '8h' });

    res.json({
      success: true,
      message: 'Prokip location saved successfully',
      userId: user.id,
      locationId,
      token: jwtToken // Return JWT for API authentication
    });
  } catch (error) {
    console.error('Failed to save Prokip location:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Log additional context
    console.error('Request context:', {
      body: req.body,
      locationId: req.body?.locationId,
      username: req.body?.username
    });
    
    res.status(500).json({ 
      error: 'Could not save your location. Please try again.',
      details: error.message 
    });
  }
});

/**
 * Get business locations for authenticated Prokip user
 */
router.get('/prokip-locations', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Please log in to Prokip first' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const locations = await prokipService.getBusinessLocations(token);
    res.json({ success: true, locations });
  } catch (error) {
    console.error('Failed to get locations:', error.message);
    res.status(500).json({ 
      error: 'Could not load business locations. Please try again.',
      details: error.message 
    });
  }
});

/**
 * Check Prokip authentication status
 */
router.get('/prokip-status', async (req, res) => {
  try {
    // Try to get userId from request (if authenticated)
    const userId = req.userId || req.user?.id;
    const isAuthenticated = await prokipService.isAuthenticated(userId);
    const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : null;
    
    res.json({
      authenticated: isAuthenticated,
      hasLocation: !!config?.locationId,
      locationId: config?.locationId || null,
      userId
    });
  } catch (error) {
    res.json({ authenticated: false, hasLocation: false });
  }
});

/**
 * Logout from Prokip
 */
router.post('/prokip-logout', authenticateToken, async (req, res) => {
  try {
    // Get userId from authentication middleware
    const userId = req.userId || req.user?.id;
    
    if (userId) {
      await prokipService.clearAuthentication(userId);
      console.log(`✅ User ${userId} logged out successfully`);
    } else {
      // Fallback: clear all if no specific user
      await prokipService.clearAuthentication();
      console.log('⚠️ Logout called without user ID - cleared all authentication');
    }
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;
