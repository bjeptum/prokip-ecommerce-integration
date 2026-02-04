const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const ProkipService = require('./services/ProkipService');
const PlatformAdapterFactory = require('./adapters/PlatformAdapterFactory');
const ConnectionManager = require('./services/ConnectionManager');
const SyncManager = require('./services/SyncManager');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

// Initialize services
const prokipService = new ProkipService();
const platformAdapterFactory = new PlatformAdapterFactory();
const connectionManager = new ConnectionManager(prokipService);
const syncManager = new SyncManager(prokipService, platformAdapterFactory);

// Routes
app.post('/api/connect-store', async (req, res) => {
  try {
    const { platform, storeUrl, credentials } = req.body;
    
    // Validate required fields
    if (!platform || !storeUrl || !credentials) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: platform, storeUrl, credentials'
      });
    }
    
    // Get platform adapter
    const adapter = platformAdapterFactory.getAdapter(platform);
    
    // Validate credentials format for platform
    const validation = adapter.validateCredentials(credentials);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: `Invalid credentials for ${platform}: ${validation.error}`
      });
    }
    
    // Normalize credentials
    const normalizedCredentials = adapter.normalizeCredentials(credentials);
    
    // Connect store via Prokip API
    const connectionResult = await connectionManager.connectStore({
      platform,
      storeUrl,
      credentials: normalizedCredentials
    });
    
    res.json(connectionResult);
    
  } catch (error) {
    errorHandler(error, req, res);
  }
});

app.post('/api/test-connection', async (req, res) => {
  try {
    const { store_id } = req.body;
    
    if (!store_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: store_id'
      });
    }
    
    const testResult = await connectionManager.testConnection(store_id);
    res.json(testResult);
    
  } catch (error) {
    errorHandler(error, req, res);
  }
});

app.post('/api/sync-products', async (req, res) => {
  try {
    const { store_id, options = {} } = req.body;
    
    if (!store_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: store_id'
      });
    }
    
    // Start async sync process
    const syncJob = await syncManager.syncProducts(store_id, options);
    
    res.json({
      success: true,
      message: 'Product sync started',
      job_id: syncJob.id,
      status: syncJob.status
    });
    
  } catch (error) {
    errorHandler(error, req, res);
  }
});

app.post('/api/sync-orders', async (req, res) => {
  try {
    const { store_id, options = {} } = req.body;
    
    if (!store_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: store_id'
      });
    }
    
    // Start async sync process
    const syncJob = await syncManager.syncOrders(store_id, options);
    
    res.json({
      success: true,
      message: 'Order sync started',
      job_id: syncJob.id,
      status: syncJob.status
    });
    
  } catch (error) {
    errorHandler(error, req, res);
  }
});

app.get('/api/sync-status/:job_id', async (req, res) => {
  try {
    const { job_id } = req.params;
    const status = await syncManager.getSyncStatus(job_id);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Sync job not found'
      });
    }
    
    res.json(status);
    
  } catch (error) {
    errorHandler(error, req, res);
  }
});

app.get('/api/stores', async (req, res) => {
  try {
    const stores = await prokipService.getStores();
    res.json({
      success: true,
      stores
    });
    
  } catch (error) {
    errorHandler(error, req, res);
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Prokip Connector Plugin is running',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Prokip Connector Plugin running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔗 Prokip API: ${process.env.PROKIP_API_URL || 'https://api.prokip.africa'}`);
});

module.exports = app;
