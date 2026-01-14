const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');
const prokipService = require('../services/prokipService');

const router = express.Router();
const prisma = new PrismaClient();

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
 * Prokip Login - Authenticate user with Prokip API
 * This endpoint gets an access token from Prokip using user credentials
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
    // Authenticate with Prokip API
    const tokenData = await prokipService.authenticateUser(username, password);
    
    const { access_token, refresh_token, expires_in } = tokenData;

    // Get business locations for this user
    const locations = await prokipService.getBusinessLocations(access_token);

    // If locationId is provided, save the config immediately
    if (locationId) {
      await prokipService.saveProkipConfig({
        access_token,
        refresh_token,
        expires_in,
        locationId
      });
    }

    res.json({ 
      success: true,
      access_token, 
      refresh_token,
      expires_in,
      locations,
      message: 'Login successful' 
    });
  } catch (error) {
    console.error('❌ Prokip login error in auth route:');
    console.error('   Error message:', error.message);
    console.error('   Error response:', error.response?.data);
    console.error('   Error status:', error.response?.status);
    console.error('   Error code:', error.code);
    
    // Send detailed error response to client
    res.status(400).json({ 
      error: error.message || 'Login failed. Please check your email and password.',
      details: error.response?.data || 'Unknown error',
      status: error.response?.status,
      code: error.code
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
    // Create or find user based on locationId (using locationId as unique identifier)
    const uniqueUsername = `prokip_${locationId}`;
    let user = await prisma.user.findUnique({ where: { username: uniqueUsername } });
    
    if (!user) {
      // Create new user for this Prokip location
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(`prokip_${locationId}_${Date.now()}`, 10);
      user = await prisma.user.create({
        data: {
          username: uniqueUsername,
          password: hashedPassword
        }
      });
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
router.post('/prokip-logout', async (req, res) => {
  try {
    await prokipService.clearAuthentication();
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;
