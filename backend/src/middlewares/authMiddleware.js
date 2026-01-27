const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  
  // Try to verify as JWT first
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.user = decoded;
    console.log('✅ JWT token validated for user:', decoded.id);
    return next();
  } catch (jwtError) {
    // If JWT verification fails, check if it's a Prokip token
    console.log('🔑 JWT verification failed, checking as Prokip token');
    
    // Use originalUrl directly - it already contains the full path from root
    const originalUrl = req.originalUrl || req.url || '';
    
    console.log('🔍 Route detection debug:');
    console.log('  - originalUrl:', originalUrl);
    
    // Check multiple ways to detect Prokip routes and WooCommerce store routes
    const isProkipRoute = (originalUrl && originalUrl.startsWith('/prokip/')) ||
                         (req.path && req.path.startsWith('/prokip/')) ||
                         (req.originalUrl && req.originalUrl.startsWith('/auth/prokip-')) ||
                         // WooCommerce store routes - these should use JWT authentication
                         (originalUrl && originalUrl.startsWith('/stores/')) ||
                         (req.path && req.path.startsWith('/stores/')) ||
                         // Setup and sync routes - these should use JWT authentication
                         (originalUrl && (originalUrl.startsWith('/setup/') || originalUrl.startsWith('/sync/')));
    
    if (isProkipRoute) {
      console.log('🔍 Prokip route detected, using Prokip token validation');
      
      // For Prokip routes, get user from Prokip config
      console.log('🔍 Looking for Prokip config with token...');
      console.log('🔍 Token length:', token.length);
      console.log('🔍 Token preview:', token.substring(0, 50) + '...');
      
      prisma.prokipConfig.findMany()
        .then(allConfigs => {
          console.log('📋 Total Prokip configs found:', allConfigs.length);
          
          allConfigs.forEach((config, index) => {
            console.log(`Config ${index + 1}:`, {
              userId: config.userId,
              tokenLength: config.token ? config.token.length : 0,
              tokenPreview: config.token ? config.token.substring(0, 50) + '...' : 'null',
              locationId: config.locationId
            });
          });
          
          const prokipConfig = allConfigs.find(config => config.token === token);
          
          if (prokipConfig) {
            req.userId = prokipConfig.userId;
            req.user = { id: prokipConfig.userId };
            console.log('✅ Prokip token validated for user:', prokipConfig.userId);
            next();
          } else {
            console.log('❌ No Prokip config found for token');
            console.log('🔍 Trying exact match vs stored tokens...');
            return res.status(401).json({ error: 'Invalid Prokip token - no config found' });
          }
        })
        .catch(error => {
          console.error('❌ Error validating Prokip token:', error);
          return res.status(500).json({ error: 'Token validation failed' });
        });
    } else {
      // For WooCommerce store routes and setup/sync routes, require valid JWT
      console.log('🔍 WooCommerce/Setup route detected, using JWT validation');
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.id;
        req.user = decoded;
        console.log('✅ JWT token validated for user:', decoded.id);
        return next();
      } catch (jwtError) {
        console.log('❌ JWT verification failed for WooCommerce/Setup route');
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
    }
  }
};

module.exports = authenticateToken;
