const express = require('express');
const { PrismaClient } = require('@prisma/client');
const wooAppPasswordServiceEnhanced = require('../services/wooAppPasswordServiceEnhanced');
const { getWooProducts } = require('../services/wooService');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Enhanced WooCommerce connection route with Application Password support
 */
router.post('/woocommerce/connect', async (req, res) => {
  try {
    const { storeUrl, username, password } = req.body;

    if (!storeUrl || !username || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Store URL, username, and password are required'
      });
    }

    console.log('🔍 Testing enhanced WooCommerce connection...');
    console.log('Store URL:', storeUrl);
    console.log('Username:', username);

    // Step 1: Test connection with Application Password
    console.log('🔐 Testing Application Password authentication...');
    const connectionTest = await wooAppPasswordServiceEnhanced.testConnection(storeUrl, username, password);

    if (!connectionTest) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Unable to connect to WooCommerce. Please verify your credentials and store configuration.',
        details: {
          troubleshooting: [
            'Verify your WordPress admin credentials work in WordPress admin',
            'Ensure WooCommerce REST API is enabled (WooCommerce → Settings → Advanced → Legacy API)',
            'Check if Application Passwords are allowed (WordPress 5.6+)',
            'Verify your store URL is correct and accessible',
            'Check if security plugins are blocking API access',
            'Ensure your user has Administrator role',
            'Try temporarily disabling security plugins to test'
          ],
          commonIssues: [
            'Wrong WordPress username/password',
            'WooCommerce REST API disabled',
            'Security plugin blocking requests',
            'Invalid store URL',
            'Insufficient user permissions'
          ]
        }
      });
    }

    // Step 2: Check permissions and provide detailed feedback
    console.log('🔍 Checking WooCommerce permissions...');
    const permissionCheck = await wooAppPasswordServiceEnhanced.checkAndFixPermissions(storeUrl, username, password);

    if (!permissionCheck.success) {
      return res.status(401).json({
        error: 'Permission denied',
        message: permissionCheck.message,
        issue: permissionCheck.issue,
        details: {
          suggestions: permissionCheck.suggestions,
          troubleshooting: permissionCheck.suggestions
        }
      });
    }

    // Step 3: Create or update connection
    console.log('💾 Saving connection to database...');
    
    // Check if connection already exists
    const existingConnection = await prisma.connection.findFirst({
      where: {
        platform: 'woocommerce',
        storeUrl: storeUrl
      }
    });

    let connection;
    if (existingConnection) {
      // Update existing connection
      connection = await prisma.connection.update({
        where: { id: existingConnection.id },
        data: {
          wooUsername: username,
          wooAppPassword: password,
          wooAppName: 'Direct Credentials (Enhanced)',
          consumerKey: null,
          consumerSecret: null,
          accessToken: null,
          accessTokenSecret: null,
          lastSync: new Date(),
          syncEnabled: true
        }
      });
      console.log('✅ Updated existing connection');
    } else {
      // Create new connection
      connection = await prisma.connection.create({
        data: {
          platform: 'woocommerce',
          storeUrl: storeUrl,
          wooUsername: username,
          wooAppPassword: password,
          wooAppName: 'Direct Credentials (Enhanced)',
          lastSync: new Date(),
          syncEnabled: true
        }
      });
      console.log('✅ Created new connection');
    }

    // Step 4: Test products endpoint to ensure full functionality
    console.log('🧪 Testing products endpoint...');
    try {
      const products = await getWooProducts(storeUrl, null, null, null, null, username, password);
      console.log(`✅ Products endpoint working: ${products.length} products found`);
    } catch (productError) {
      console.log('⚠️  Products endpoint failed, but connection is established');
      console.log('Product error:', productError.message);
      
      // Don't fail the connection, but warn the user
      return res.status(200).json({
        success: true,
        message: 'WooCommerce store connected successfully, but products may not be accessible',
        warning: 'Products endpoint returned an error. Check user permissions.',
        storeUrl: storeUrl,
        appName: 'Direct Credentials (Enhanced)',
        connectionId: connection.id,
        productError: productError.message
      });
    }

    // Step 5: Success response
    res.json({
      success: true,
      message: 'WooCommerce store connected successfully',
      storeUrl: storeUrl,
      appName: 'Direct Credentials (Enhanced)',
      connectionId: connection.id
    });

  } catch (error) {
    console.error('❌ Enhanced WooCommerce connection failed:', error);
    
    res.status(500).json({
      error: 'Connection failed',
      message: error.message,
      details: {
        troubleshooting: [
          'Check if your WordPress site is accessible',
          'Verify WooCommerce is properly installed and activated',
          'Ensure REST API is enabled in WooCommerce settings',
          'Check for server or network connectivity issues',
          'Verify your credentials are correct'
        ]
      }
    });
  }
});

/**
 * Enhanced permission check endpoint
 */
router.post('/woocommerce/check-permissions', async (req, res) => {
  try {
    const { storeUrl, username, password } = req.body;

    if (!storeUrl || !username || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Store URL, username, and password are required'
      });
    }

    const permissionCheck = await wooAppPasswordServiceEnhanced.checkAndFixPermissions(storeUrl, username, password);
    
    res.json(permissionCheck);

  } catch (error) {
    console.error('❌ Permission check failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to check permissions',
      error: error.message
    });
  }
});

/**
 * Test connection without saving
 */
router.post('/woocommerce/test', async (req, res) => {
  try {
    const { storeUrl, username, password } = req.body;

    if (!storeUrl || !username || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Store URL, username, and password are required'
      });
    }

    const connectionTest = await wooAppPasswordServiceEnhanced.testConnection(storeUrl, username, password);
    const permissionCheck = await wooAppPasswordServiceEnhanced.checkAndFixPermissions(storeUrl, username, password);

    res.json({
      connectionTest: connectionTest,
      permissionCheck: permissionCheck
    });

  } catch (error) {
    console.error('❌ Test connection failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to test connection',
      error: error.message
    });
  }
});

module.exports = router;
