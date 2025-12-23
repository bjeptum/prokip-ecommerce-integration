require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');

const authRoutes = require('./routes/authRoutes');
const connectionRoutes = require('./routes/connectionRoutes');
const setupRoutes = require('./routes/setupRoutes');
const syncRoutes = require('./routes/syncRoutes');
const authMiddleware = require('./middlewares/authMiddleware');
const { pollProkipToStores } = require('./services/syncService');

const app = express();
const prisma = new PrismaClient();

app.use(bodyParser.json());
app.use(bodyParser.raw({ type: 'application/json' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../../frontend/public')));

// Public routes
app.use('/auth', authRoutes);

// Protected routes
app.use('/connections', authMiddleware, connectionRoutes);
app.use('/setup', authMiddleware, setupRoutes);
app.use('/sync', authMiddleware, syncRoutes);

// Root route - serve dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/public/index.html'));
});

// Periodic inventory sync from Prokip → Stores
cron.schedule('*/5 * * * *', async () => {
  await pollProkipToStores();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
