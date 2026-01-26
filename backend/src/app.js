const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
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

// Load OpenAPI specification
const swaggerDocument = YAML.load(path.join(__dirname, '../../docs/openapi.yaml'));

const app = express();
const prisma = new PrismaClient();

// Ensure there is at least one admin user to allow login.
async function ensureDefaultUser() {
  const username = process.env.DEFAULT_ADMIN_USER;
  const password = process.env.DEFAULT_ADMIN_PASS;

  if (!username || !password) return; // user will have to register manually

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return;

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { username, password: hashed } });
  console.log(`Default admin user '${username}' created from env DEFAULT_ADMIN_USER/DEFAULT_ADMIN_PASS`);
}

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

// API Documentation (Swagger UI)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Prokip E-commerce Integration API Docs'
}));

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
    console.log('✅ Database connected');
    
    // Ensure default admin user exists
    await ensureDefaultUser();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
