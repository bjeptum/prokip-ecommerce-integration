const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    // Try to verify as JWT first
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.user = decoded;
    return next();
  } catch (jwtError) {
    // If JWT verification fails, check if it's a Prokip token
    // Check if the token is signed for Prokip routes by checking the JWT payload
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if this is a Prokip token by looking for a specific claim
      if (decoded.type === 'prokip' || decoded.platform === 'prokip') {
        // Validate against Prokip config
        const prokipConfig = await prisma.prokipConfig.findUnique({
          where: { token: token }
        });
        
        if (prokipConfig) {
          req.userId = prokipConfig.userId;
          req.user = { id: prokipConfig.userId, type: 'prokip' };
          return next();
        }
      }
    } catch (prokipError) {
      // Continue to error response
    }
    
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = authenticateToken;
