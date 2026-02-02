/**
 * Debug the authentication token issue
 */

const prisma = require('./src/lib/prisma');

async function debugTokenIssue() {
  try {
    console.log('🔍 Debugging token authentication issue...\n');
    
    // Get all Prokip configs for user 50
    const configs = await prisma.prokipConfig.findMany({ 
      where: { userId: 50 } 
    });
    
    console.log(`📊 Found ${configs.length} Prokip configs for user 50:`);
    
    configs.forEach((config, index) => {
      console.log(`\n${index + 1}. Config ID: ${config.id}`);
      console.log(`   User ID: ${config.userId}`);
      console.log(`   Location ID: ${config.locationId}`);
      console.log(`   Token present: ${!!config.token}`);
      console.log(`   Token length: ${config.token?.length || 0}`);
      console.log(`   Token starts with: ${config.token?.substring(0, 50)}...`);
      console.log(`   Created: ${config.createdAt}`);
      console.log(`   Updated: ${config.updatedAt}`);
    });
    
    // Check if there are multiple configs or if the token is missing
    if (configs.length === 0) {
      console.log('\n❌ No Prokip config found for user 50');
      console.log('💡 This means the user needs to log in again');
    } else if (configs.length > 1) {
      console.log('\n⚠️ Multiple Prokip configs found - this could cause conflicts');
    } else {
      console.log('\n✅ Single Prokip config found');
      
      const config = configs[0];
      if (!config.token) {
        console.log('❌ Token is null/empty - user needs to re-authenticate');
      } else {
        console.log('✅ Token exists and looks valid');
      }
    }
    
    // Check frontend token storage simulation
    console.log('\n🔍 Checking what the frontend might be sending...');
    
    // Simulate the exact token the frontend would use
    if (configs.length > 0 && configs[0].token) {
      const frontendToken = configs[0].token;
      console.log('Frontend would send token:', frontendToken.substring(0, 50) + '...');
      
      // Test database lookup with this exact token
      const foundConfig = await prisma.prokipConfig.findFirst({ 
        where: { token: frontendToken } 
      });
      
      if (foundConfig) {
        console.log('✅ Token lookup successful - config found');
        console.log(`   Found config ID: ${foundConfig.id}`);
      } else {
        console.log('❌ Token lookup failed - no config found');
        console.log('💡 This suggests the token in the database doesn\'t match what we\'re searching for');
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugTokenIssue();
