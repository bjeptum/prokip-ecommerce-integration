require('dotenv').config();

const express = require('express');

// Create simple test to check route mounting
const app = express();

// Try to mount PAT routes directly
try {
  const patRoutes = require('./src/routes/personalAccessTokenRoutes');
  app.use('/api/tokens', patRoutes);
  console.log('✅ PAT routes mounted successfully');
  
  // Check if routes exist by looking at the router
  console.log('📋 PAT router stack length:', patRoutes.stack.length);
  
  patRoutes.stack.forEach((layer, index) => {
    if (layer.route) {
      console.log(`  Route ${index}: ${layer.route.path} [${Object.keys(layer.route.methods).join(', ')}]`);
    } else if (layer.name === 'router') {
      console.log(`  Router ${index}: ${layer.regexp}`);
    }
  });
  
} catch (error) {
  console.log('❌ Failed to mount PAT routes:', error.message);
}

// Test auth routes
try {
  const authRoutes = require('./src/routes/authRoutes');
  app.use('/auth', authRoutes);
  console.log('✅ Auth routes mounted successfully');
  
  console.log('📋 Auth router stack length:', authRoutes.stack.length);
  
  authRoutes.stack.forEach((layer, index) => {
    if (layer.route) {
      console.log(`  Route ${index}: ${layer.route.path} [${Object.keys(layer.route.methods).join(', ')}]`);
    } else if (layer.name === 'router') {
      console.log(`  Router ${index}: ${layer.regexp}`);
    }
  });
  
} catch (error) {
  console.log('❌ Failed to mount auth routes:', error.message);
}

console.log('\n🎯 ROUTE ANALYSIS COMPLETE');
