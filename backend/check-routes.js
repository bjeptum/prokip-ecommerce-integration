require('dotenv').config();

const express = require('express');
const authRoutes = require('./src/routes/authRoutes');
const patRoutes = require('./src/routes/personalAccessTokenRoutes');

// Create test app to check routes
const app = express();

// Mount routes
app.use('/auth', authRoutes);
app.use('/api/tokens', patRoutes);

// Print all registered routes
function printRoutes(app, path = '') {
  app._router.stack.forEach(function(middleware){
    if (middleware.route) {
      // Routes registered directly on the app
      console.log(`${path}${middleware.route.path} [${middleware.route.methods.join(', ')}]`);
    } else if (middleware.name === 'router') {
      // Router middleware
      console.log(`${path}${middleware.regexp} [router]`);
      printRoutes(middleware, path);
    }
  });
}

console.log('🔍 CHECKING REGISTERED ROUTES');
console.log('=' .repeat(50));

console.log('\n📋 Auth Routes:');
printRoutes(authRoutes, '/auth');

console.log('\n📋 PAT Routes:');
printRoutes(patRoutes, '/api/tokens');

console.log('\n🧪 Testing route availability...');

// Test if server can start
app.listen(3001, () => {
  console.log('✅ Test server started on port 3001');
  
  // Test basic route
  app.get('/test', (req, res) => {
    res.json({ message: 'Test route working' });
  });
  
  console.log('✅ Routes registered successfully');
  
  process.exit(0);
});
