const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const authRoutes = require('./routes/authRoutes');
const connectionRoutes = require('./routes/connectionRoutes');
const wooConnectionRoutes = require('./routes/wooConnectionRoutes');
const storeRoutes = require('./routes/storeRoutesSecure');
const syncRoutes = require('./routes/syncRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0.0-secure'
  });
});

// Routes
app.use('/auth', authRoutes);
app.use('/connections', connectionRoutes);
app.use('/woo-connections', wooConnectionRoutes);
app.use('/stores', storeRoutes);
app.use('/sync', syncRoutes);
app.use('/webhooks', webhookRoutes);

// Serve static files (for frontend)
app.use(express.static('public'));

// Default route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Prokip E-commerce Integration API v2.0 (Secure)',
    version: '2.0.0-secure',
    endpoints: {
      auth: '/auth',
      connections: '/connections',
      wooConnections: '/woo-connections',
      stores: '/stores',
      sync: '/sync',
      webhooks: '/webhooks'
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  // Don't expose sensitive error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    error: 'Internal server error',
    message: isDevelopment ? error.message : 'Something went wrong',
    ...(isDevelopment && { stack: error.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint was not found',
    path: req.path
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Prokip Backend Server v2.0 (Secure) running on http://localhost:${PORT}`);
      console.log('📚 API Documentation:');
      console.log('   POST /woo-connections/test - Test WooCommerce connection');
      console.log('   POST /woo-connections/connect - Connect WooCommerce store');
      console.log('   GET  /woo-connections/connections - Get user connections');
      console.log('   PUT  /woo-connections/connections/:id - Update connection');
      console.log('   DELETE /woo-connections/connections/:id - Delete connection');
      console.log('   GET  /woo-connections/connections/:id/status - Check connection status');
      console.log('   GET  /stores/:id/products - Get store products (secure)');
      console.log('   GET  /stores/:id/orders - Get store orders (secure)');
      console.log('');
      console.log('🔐 Security Features:');
      console.log('   ✅ Encrypted Consumer Key/Secret storage');
      console.log('   ✅ Multi-user authentication');
      console.log('   ✅ Secure API endpoints');
      console.log('   ✅ No sensitive data in frontend');
      console.log('   ✅ Proper error handling');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
