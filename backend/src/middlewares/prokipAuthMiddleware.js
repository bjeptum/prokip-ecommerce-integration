const prisma = require('../lib/prisma');

const authenticateProkipOrJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    // First try to validate as Prokip OAuth token
    const prokipConfig = await prisma.prokipConfig.findFirst({
      where: { token: token }
    });
    
    if (prokipConfig) {
      console.log('✅ Prokip token authenticated for user:', prokipConfig.userId);
      req.userId = prokipConfig.userId;
      req.user = { id: prokipConfig.userId, type: 'prokip' };
      req.prokipConfig = prokipConfig;
      return next();
    }
    
    // If not a Prokip token, try JWT validation
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.user = decoded;
    return next();
    
  } catch (error) {
    console.log('❌ Authentication failed:', error.message);
    return res.status(401).json({ 
      error: 'Invalid or expired token',
      details: 'Token could not be validated as either Prokip OAuth or JWT'
    });
  }
};

module.exports = authenticateProkipOrJWT;
