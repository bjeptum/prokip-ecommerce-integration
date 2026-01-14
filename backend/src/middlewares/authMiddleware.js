const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = (req, res, next) => {
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
    
    // Check if this is a Prokip-specific route
    const isProkipRoute = originalUrl.startsWith('/prokip/') ||
                         originalUrl.startsWith('/auth/prokip-');
    
    // For ALL routes (Prokip or not), try to authenticate via Prokip token
    console.log('🔍 Looking for Prokip config with token...');
    
    prisma.prokipConfig.findMany()
      .then(allConfigs => {
        console.log('📋 Total Prokip configs found:', allConfigs.length);
        
        const prokipConfig = allConfigs.find(config => config.token === token);
        
        if (prokipConfig) {
          req.userId = prokipConfig.userId;
          req.user = { id: prokipConfig.userId };
          console.log('✅ Prokip token validated for user:', prokipConfig.userId);
          next();
        } else {
          console.log('❌ No Prokip config found for token');
          if (isProkipRoute) {
            return res.status(401).json({ error: 'Invalid Prokip token - please log in again' });
          } else {
            return res.status(403).json({ error: 'Invalid or expired token. Please log in again.' });
          }
        }
      })
      .catch(error => {
        console.error('❌ Error validating Prokip token:', error);
        return res.status(500).json({ error: 'Token validation failed' });
      });
  }
};
