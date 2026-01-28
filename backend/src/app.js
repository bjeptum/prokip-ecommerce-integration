const express = require('express');
const cors = require('cors');
const path = require('path');
const prisma = require('./lib/prisma');
const bcrypt = require('bcryptjs');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const packageJson = require('../package.json');
const authRoutes = require('./routes/authRoutes');
const connectionRoutes = require('./routes/connectionRoutes');
const wooConnectionRoutes = require('./routes/wooConnectionRoutes');
const storeRoutes = require('./routes/storeRoutes');
const syncRoutes = require('./routes/syncRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const prokipRoutes = require('./routes/prokipRoutes');
const setupRoutes = require('./routes/setupRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const bidirectionalSyncRoutes = require('./routes/bidirectionalSyncRoutes');

// Load OpenAPI specification (commented out for now)
// const swaggerDocument = YAML.load(path.join(__dirname, '../../docs/openapi.yaml'));

const app = express();

// Ensure there is at least one admin user to allow login.
async function ensureDefaultUser() {
  const username = process.env.DEFAULT_ADMIN_USER;
  const password = process.env.DEFAULT_ADMIN_PASS;

  if (!username || !password) return; // user will have to register manually

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return;

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { username, password: hashed } });
}

// Middleware
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] // Add your production domains
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} - ${Date.now() - start}ms` 
    );
  });
  
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: packageJson.version || '1.0.0'
  });
});

// API Documentation (Swagger UI) - commented out for now
// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
//   customCss: '.swagger-ui .topbar { display: none }',
//   customSiteTitle: 'Prokip E-commerce Integration API Docs'
// }));

// Routes
app.use('/auth', authRoutes);
app.use('/connections', connectionRoutes);
app.use('/woo-connections', wooConnectionRoutes);
app.use('/stores', storeRoutes);
app.use('/sync', syncRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/prokip', prokipRoutes);
app.use('/setup', setupRoutes);
app.use('/api', analyticsRoutes);
app.use('/bidirectional-sync', bidirectionalSyncRoutes);

// Serve static files (for frontend)
app.use(express.static('../frontend/public'));

// Default route - serve frontend
app.get('/', (req, res) => {
  res.sendFile(require('path').join(__dirname, '../frontend/public/index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  // Log the error
  console.error('Unhandled error:', {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  // Don't expose sensitive error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Handle different error types
  if (error.status || error.statusCode) {
    const statusCode = error.status || error.statusCode;
    return res.status(statusCode).json({
      error: error.message || 'Request failed',
      ...(isDevelopment && { stack: error.stack })
    });
  }
  
  // Default error response
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
    
    // Ensure default admin user exists
    await ensureDefaultUser();
    console.log('✅ Default user check completed');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🌐 Frontend: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

startServer();
