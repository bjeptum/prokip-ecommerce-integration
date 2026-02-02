// Test if the routes can be imported without errors
console.log('🧪 Testing route imports...');

try {
  console.log('1️⃣ Testing prokipUserAuthService import...');
  const ProkipUserAuthService = require('./src/services/prokipUserAuthService');
  console.log('✅ prokipUserAuthService imported successfully');
  
  console.log('2️⃣ Testing wooToProkipUserService import...');
  const WooToProkipUserService = require('./src/services/wooToProkipUserService');
  console.log('✅ wooToProkipUserService imported successfully');
  
  console.log('3️⃣ Testing prokipUserRoutes import...');
  const prokipUserRoutes = require('./src/routes/prokipUserRoutes');
  console.log('✅ prokipUserRoutes imported successfully');
  
  console.log('4️⃣ Testing route instantiation...');
  const authService = new ProkipUserAuthService();
  console.log('✅ authService instantiated');
  
  const wooService = new WooToProkipUserService();
  console.log('✅ wooService instantiated');
  
  console.log('\n🎉 All imports successful! Routes should work.');
  
} catch (error) {
  console.error('❌ Import failed:', error.message);
  console.error('Stack:', error.stack);
}
