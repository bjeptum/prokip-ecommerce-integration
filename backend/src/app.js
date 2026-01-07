require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const authRoutes = require('./routes/authRoutes');
const connectionRoutes = require('./routes/connectionRoutes');
const setupRoutes = require('./routes/setupRoutes');
const syncRoutes = require('./routes/syncRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const storeRoutes = require('./routes/storeRoutes');
const prokipRoutes = require('./routes/prokipRoutes');
const authMiddleware = require('./middlewares/authMiddleware');
const { pollProkipToStores } = require('./services/syncService');

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

app.use(bodyParser.json());
app.use(bodyParser.raw({ type: 'application/json' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../../frontend/public')));

// Public routes
app.use('/auth', authRoutes);
app.use('/webhook', webhookRoutes);

// Protected routes (with exceptions for callbacks)
// Callback routes are public - must come before the protected middleware
const skipAuthForCallbacks = (req, res, next) => {
  if (req.path.startsWith('/callback/')) {
    return next();
  }
  return authMiddleware(req, res, next);
};

app.use('/connections', skipAuthForCallbacks, connectionRoutes);
app.use('/setup', authMiddleware, setupRoutes);
app.use('/sync', authMiddleware, syncRoutes);
app.use('/stores', authMiddleware, storeRoutes);
app.use('/prokip', authMiddleware, prokipRoutes);

// Root route - serve dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/public/index.html'));
});

// Periodic inventory sync from Prokip → Stores
cron.schedule('*/5 * * * *', async () => {
  await pollProkipToStores();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await ensureDefaultUser();
  console.log(`Backend server running on http://localhost:${PORT}`);
});
