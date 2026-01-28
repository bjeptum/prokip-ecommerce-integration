const express = require('express');
const prisma = require('../lib/prisma');
const wooSecureService = require('../services/wooSecureService');
const authenticateToken = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * Middleware to authenticate all routes - supports both JWT and Prokip tokens
 */
router.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  
  // Try to verify as JWT first
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.user = decoded;
    return next();
  } catch (jwtError) {
    // If JWT fails, try Prokip token
    const prisma = require('../lib/prisma');
    
    prisma.prokipConfig.findMany()
      .then(allConfigs => {
        const prokipConfig = allConfigs.find(config => config.token === token);
        
        if (prokipConfig) {
          req.userId = prokipConfig.userId;
          req.user = { id: prokipConfig.userId };
          return next();
        } else {
          return res.status(403).json({ error: 'Invalid or expired token' });
        }
      })
      .catch(error => {
        console.error('Authentication error:', error);
        return res.status(500).json({ error: 'Authentication failed' });
      });
  }
});

/**
 * Test WooCommerce connection without storing
 */
router.post('/test', async (req, res) => {
  try {
    const { storeUrl, consumerKey, consumerSecret } = req.body;

    if (!storeUrl || !consumerKey || !consumerSecret) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Store URL, Consumer Key, and Consumer Secret are required'
      });
    }

    // Validate URL format
    try {
      new URL(storeUrl);
    } catch {
      return res.status(400).json({
        error: 'Invalid URL',
        message: 'Please provide a valid store URL (e.g., https://yourstore.com)'
      });
    }

    // Test connection
    const testResult = await wooSecureService.testConnection(storeUrl, consumerKey, consumerSecret);

    if (testResult.valid) {
      res.json({
        success: true,
        message: 'Connection test successful',
        storeInfo: testResult.storeInfo,
        testResults: testResult.testResults
      });
    } else {
      res.status(400).json({
        success: false,
        error: testResult.error,
        message: testResult.message,
        details: testResult.details,
        suggestions: getErrorSuggestions(testResult.error)
      });
    }

  } catch (error) {
    console.error('Connection test error:', error);
    res.status(500).json({
      success: false,
      error: 'TEST_FAILED',
      message: 'Connection test failed',
      details: error.message
    });
  }
});

/**
 * Connect WooCommerce store (secure, multi-user)
 */
router.post('/connect', async (req, res) => {
  try {
    const { storeUrl, consumerKey, consumerSecret, storeName } = req.body;
    const userId = req.userId; // Fixed: use req.userId instead of req.user.id

    if (!storeUrl || !consumerKey || !consumerSecret) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Store URL, Consumer Key, and Consumer Secret are required'
      });
    }

    // Validate URL format
    try {
      new URL(storeUrl);
    } catch {
      return res.status(400).json({
        error: 'Invalid URL',
        message: 'Please provide a valid store URL (e.g., https://yourstore.com)'
      });
    }

    // Test credentials first
    const validation = await wooSecureService.validateCredentials(storeUrl, consumerKey, consumerSecret);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
        message: validation.message,
        details: validation.details,
        suggestions: getErrorSuggestions(validation.error)
      });
    }

    // Check if user already has a connection for this store
    const existingConnection = await prisma.connection.findFirst({
      where: {
        userId: userId,
        platform: 'woocommerce',
        storeUrl: storeUrl
      }
    });

    // Encrypt credentials
    const encryptedKey = wooSecureService.encrypt(consumerKey);
    const encryptedSecret = wooSecureService.encrypt(consumerSecret);

    let connection;
    if (existingConnection) {
      // Update existing connection
      connection = await prisma.connection.update({
        where: { id: existingConnection.id },
        data: {
          consumerKey: JSON.stringify(encryptedKey),
          consumerSecret: JSON.stringify(encryptedSecret),
          storeName: storeName || `WooCommerce Store (${new URL(storeUrl).hostname})`,
          lastSync: new Date(),
          syncEnabled: true,
          wooUsername: null, // Clear old auth methods
          wooAppPassword: null,
          accessToken: null,
          accessTokenSecret: null
        }
      });
      console.log(`✅ Updated WooCommerce connection for user ${userId}`);
    } else {
      // Create new connection
      connection = await prisma.connection.create({
        data: {
          userId: userId,
          platform: 'woocommerce',
          storeUrl: storeUrl,
          storeName: storeName || `WooCommerce Store (${new URL(storeUrl).hostname})`,
          consumerKey: JSON.stringify(encryptedKey),
          consumerSecret: JSON.stringify(encryptedSecret),
          lastSync: new Date(),
          syncEnabled: true
        }
      });
      console.log(`✅ Created new WooCommerce connection for user ${userId}`);
    }

    // Get store info
    const storeInfo = await wooSecureService.getStoreInfo(storeUrl, consumerKey, consumerSecret);

    // Return success response (without sensitive data)
    res.json({
      success: true,
      message: 'WooCommerce store connected successfully',
      connection: {
        id: connection.id,
        platform: connection.platform,
        storeUrl: connection.storeUrl,
        storeName: connection.storeName,
        lastSync: connection.lastSync,
        syncEnabled: connection.syncEnabled,
        storeInfo: storeInfo
      }
    });

  } catch (error) {
    console.error('WooCommerce connection error:', error);
    res.status(500).json({
      success: false,
      error: 'CONNECTION_FAILED',
      message: 'Failed to connect WooCommerce store',
      details: error.message
    });
  }
});

/**
 * Get user's WooCommerce connections
 */
router.get('/connections', async (req, res) => {
  try {
    const userId = req.user.id;

    const connections = await prisma.connection.findMany({
      where: {
        userId: userId,
        platform: 'woocommerce'
      },
      select: {
        id: true,
        platform: true,
        storeUrl: true,
        storeName: true,
        lastSync: true,
        syncEnabled: true,
        createdAt: true,
        consumerKey: true // We'll format this for display
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Format connections for display (hide sensitive data)
    const formattedConnections = connections.map(conn => ({
      ...conn,
      consumerKey: conn.consumerKey ? wooSecureService.formatConsumerKeyForDisplay(
        JSON.parse(conn.consumerKey).encrypted
      ) : null,
      hasCredentials: !!(conn.consumerKey && conn.consumerSecret)
    }));

    res.json({
      success: true,
      connections: formattedConnections
    });

  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: 'Failed to fetch connections'
    });
  }
});

/**
 * Update WooCommerce connection
 */
router.put('/connections/:id', async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id);
    const { storeUrl, consumerKey, consumerSecret, storeName } = req.body;
    const userId = req.user.id;

    // Verify connection belongs to user
    const existingConnection = await prisma.connection.findFirst({
      where: {
        id: connectionId,
        userId: userId,
        platform: 'woocommerce'
      }
    });

    if (!existingConnection) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Connection not found'
      });
    }

    // Validate new credentials if provided
    if (storeUrl && consumerKey && consumerSecret) {
      const validation = await wooSecureService.validateCredentials(storeUrl, consumerKey, consumerSecret);
      
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error,
          message: validation.message,
          details: validation.details,
          suggestions: getErrorSuggestions(validation.error)
        });
      }
    }

    // Prepare update data
    const updateData = {
      lastSync: new Date()
    };

    if (storeUrl) updateData.storeUrl = storeUrl;
    if (storeName) updateData.storeName = storeName;
    if (consumerKey && consumerSecret) {
      updateData.consumerKey = JSON.stringify(wooSecureService.encrypt(consumerKey));
      updateData.consumerSecret = JSON.stringify(wooSecureService.encrypt(consumerSecret));
    }

    const updatedConnection = await prisma.connection.update({
      where: { id: connectionId },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Connection updated successfully',
      connection: {
        id: updatedConnection.id,
        platform: updatedConnection.platform,
        storeUrl: updatedConnection.storeUrl,
        storeName: updatedConnection.storeName,
        lastSync: updatedConnection.lastSync,
        syncEnabled: updatedConnection.syncEnabled
      }
    });

  } catch (error) {
    console.error('Update connection error:', error);
    res.status(500).json({
      success: false,
      error: 'UPDATE_FAILED',
      message: 'Failed to update connection'
    });
  }
});

/**
 * Delete WooCommerce connection
 */
router.delete('/connections/:id', async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id);
    const userId = req.user.id;

    // Verify connection belongs to user
    const existingConnection = await prisma.connection.findFirst({
      where: {
        id: connectionId,
        userId: userId,
        platform: 'woocommerce'
      }
    });

    if (!existingConnection) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Connection not found'
      });
    }

    await prisma.connection.delete({
      where: { id: connectionId }
    });

    console.log(`✅ Deleted WooCommerce connection ${connectionId} for user ${userId}`);

    res.json({
      success: true,
      message: 'Connection deleted successfully'
    });

  } catch (error) {
    console.error('Delete connection error:', error);
    res.status(500).json({
      success: false,
      error: 'DELETE_FAILED',
      message: 'Failed to delete connection'
    });
  }
});

/**
 * Get connection status
 */
router.get('/connections/:id/status', async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id);
    const userId = req.user.id;

    const connection = await prisma.connection.findFirst({
      where: {
        id: connectionId,
        userId: userId,
        platform: 'woocommerce'
      }
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Connection not found'
      });
    }

    // Decrypt credentials for testing
    let consumerKey, consumerSecret;
    try {
      if (connection.consumerKey && connection.consumerSecret) {
        consumerKey = wooSecureService.decrypt(JSON.parse(connection.consumerKey));
        consumerSecret = wooSecureService.decrypt(JSON.parse(connection.consumerSecret));
      }
    } catch (error) {
      console.log('❌ Failed to decrypt credentials');
      return res.json({
        success: true,
        status: 'ERROR',
        message: 'Credentials could not be decrypted',
        needsReconnect: true
      });
    }

    if (!consumerKey || !consumerSecret) {
      return res.json({
        success: true,
        status: 'NO_CREDENTIALS',
        message: 'No credentials stored',
        needsReconnect: true
      });
    }

    // Test connection
    const testResult = await wooSecureService.testConnection(connection.storeUrl, consumerKey, consumerSecret);

    res.json({
      success: true,
      status: testResult.valid ? 'CONNECTED' : 'ERROR',
      message: testResult.valid ? 'Connection is working' : testResult.message,
      lastTest: new Date(),
      needsReconnect: !testResult.valid,
      storeInfo: testResult.storeInfo
    });

  } catch (error) {
    console.error('Connection status error:', error);
    res.status(500).json({
      success: false,
      error: 'STATUS_CHECK_FAILED',
      message: 'Failed to check connection status'
    });
  }
});

/**
 * Get error suggestions based on error type
 */
function getErrorSuggestions(errorType) {
  const suggestions = {
    'INVALID_CREDENTIALS': [
      'Double-check your Consumer Key and Secret',
      'Ensure keys are copied correctly without extra spaces',
      'Generate new API keys from WooCommerce settings',
      'Verify keys have not been revoked'
    ],
    'INSUFFICIENT_PERMISSIONS': [
      'Ensure Consumer Key has Read/Write permissions',
      'Check "Allow read access to products" is enabled',
      'Verify API key permissions in WooCommerce settings',
      'Contact store administrator if needed'
    ],
    'WOOCOMMERCE_PERMISSIONS': [
      'Ensure WooCommerce REST API is enabled',
      'Check user has WooCommerce capabilities',
      'Verify API permissions in WordPress user roles',
      'Try with Administrator account'
    ],
    'INVALID_URL': [
      'Verify store URL is correct and accessible',
      'Include https:// in the URL',
      'Check if store is online and responding',
      'Try accessing the store in your browser'
    ],
    'CONNECTION_REFUSED': [
      'Check if store server is running',
      'Verify firewall settings',
      'Try again in a few minutes',
      'Contact hosting provider'
    ],
    'TIMEOUT': [
      'Check internet connection',
      'Try again with better connectivity',
      'Store may be experiencing high traffic',
      'Contact store administrator'
    ]
  };

  return suggestions[errorType] || [
    'Check all provided information',
    'Try again in a few minutes',
    'Contact support if issue persists'
  ];
}

module.exports = router;
