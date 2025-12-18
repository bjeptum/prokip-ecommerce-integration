const path = require('path');
const express = require('express');
const morgan = require('morgan');

const frontendRouter = require('./routes/frontend');
const apiRouter = require('./routes/api');
const connectRouter = require('./routes/connect');
const webhookRouter = require('./routes/webhook');

const app = express();

// Middlewares
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static frontend
app.use('/public', express.static(path.join(__dirname, '..', 'frontend')));

// Routes
app.use('/', frontendRouter);
app.use('/api', apiRouter);
app.use('/connect', connectRouter);
app.use('/webhook', webhookRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).send('Not Found');
});

// Start server only if this file is run directly
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

module.exports = app;


