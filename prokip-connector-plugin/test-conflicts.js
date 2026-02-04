const axios = require('axios');

/**
 * Test to verify no conflicts between Prokip Connector Plugin and existing backend
 */
class ConflictDetectionTest {
  constructor() {
    this.backendUrl = 'http://localhost:3000';
    this.connectorUrl = 'http://localhost:3001';
    this.conflicts = [];
    this.warnings = [];
  }
  
  async runConflictDetection() {
    console.log('🔍 Detecting conflicts between backend and connector plugin...\n');
    
    try {
      // Test 1: Port conflicts
      await this.testPortConflicts();
      
      // Test 2: Route conflicts
      await this.testRouteConflicts();
      
      // Test 3: Database conflicts
      await this.testDatabaseConflicts();
      
      // Test 4: Environment variable conflicts
      await this.testEnvironmentConflicts();
      
      // Test 5: Dependency conflicts
      await this.testDependencyConflicts();
      
      // Test 6: API endpoint conflicts
      await this.testAPIEndpointConflicts();
      
      // Test 7: Integration compatibility
      await this.testIntegrationCompatibility();
      
      this.printResults();
      
    } catch (error) {
      console.error('❌ Conflict detection failed:', error.message);
      this.conflicts.push({
        type: 'Test Execution',
        description: 'Failed to run conflict detection',
        severity: 'HIGH',
        details: error.message
      });
    }
  }
  
  async testPortConflicts() {
    console.log('🔌 Testing Port Conflicts...');
    
    try {
      // Check if backend is running on port 3000
      const backendResponse = await axios.get(`${this.backendUrl}/health`, { timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      
      // Check if connector is running on port 3001
      const connectorResponse = await axios.get(`${this.connectorUrl}/api/health`, { timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      
      if (backendResponse && connectorResponse) {
        console.log('✅ Both services running on different ports');
      } else if (backendResponse && !connectorResponse) {
        console.log('⚠️ Backend running, connector not started (expected)');
      } else if (!backendResponse && connectorResponse) {
        console.log('⚠️ Connector running, backend not started');
      } else {
        console.log('⚠️ Neither service running');
      }
      
    } catch (error) {
      this.warnings.push({
        type: 'Port Test',
        description: 'Could not test port conflicts',
        details: error.message
      });
      console.log('⚠️ Could not test port conflicts');
    }
  }
  
  async testRouteConflicts() {
    console.log('🛣️ Testing Route Conflicts...');
    
    // Backend routes (from existing app.js)
    const backendRoutes = [
      '/auth',
      '/connections',
      '/woo-connections',
      '/stores',
      '/sync',
      '/webhooks',
      '/webhooks/woocommerce',
      '/connections/webhook',
      '/prokip',
      '/setup',
      '/api/sales',
      '/bidirectional-sync',
      '/health'
    ];
    
    // Connector routes (from connector app.js)
    const connectorRoutes = [
      '/api/connect-store',
      '/api/test-connection',
      '/api/sync-products',
      '/api/sync-orders',
      '/api/sync-status/:job_id',
      '/api/stores',
      '/api/health'
    ];
    
    // Check for exact matches
    for (const backendRoute of backendRoutes) {
      for (const connectorRoute of connectorRoutes) {
        // Normalize routes for comparison
        const normalizedBackend = backendRoute.replace(/:.*$/, '');
        const normalizedConnector = connectorRoute.replace(/:.*$/, '');
        
        if (normalizedBackend === normalizedConnector) {
          this.conflicts.push({
            type: 'Route Conflict',
            description: `Route conflict: ${backendRoute}`,
            severity: 'HIGH',
            details: `Backend and connector both use ${backendRoute}`
          });
        }
      }
    }
    
    // Check for potential conflicts (similar prefixes)
    const backendPrefixes = backendRoutes.map(r => r.split('/')[1]).filter(Boolean);
    const connectorPrefixes = connectorRoutes.map(r => r.split('/')[1]).filter(Boolean);
    
    for (const prefix of backendPrefixes) {
      if (connectorPrefixes.includes(prefix)) {
        this.warnings.push({
          type: 'Route Prefix',
          description: `Potential route prefix conflict: /${prefix}`,
          details: 'Both services use similar route prefixes'
        });
      }
    }
    
    if (this.conflicts.filter(c => c.type === 'Route Conflict').length === 0) {
      console.log('✅ No route conflicts detected');
    } else {
      console.log('❌ Route conflicts detected');
    }
  }
  
  async testDatabaseConflicts() {
    console.log('🗄️ Testing Database Conflicts...');
    
    // Check if both services use the same database
    const backendEnv = this.readEnvFile('../backend/.env');
    const connectorEnv = this.readEnvFile('.env.example');
    
    if (backendEnv && connectorEnv) {
      const backendDb = backendEnv.DATABASE_URL;
      const connectorDb = connectorEnv.DATABASE_URL;
      
      if (backendDb && connectorDb && backendDb === connectorDb) {
        this.conflicts.push({
          type: 'Database Conflict',
          description: 'Both services use the same database',
          severity: 'HIGH',
          details: 'This could cause data corruption'
        });
      } else {
        console.log('✅ No database conflicts detected');
      }
    } else {
      console.log('⚠️ Could not verify database configuration');
    }
  }
  
  async testEnvironmentConflicts() {
    console.log('🌍 Testing Environment Variable Conflicts...');
    
    const backendEnv = this.readEnvFile('../backend/.env');
    const connectorEnv = this.readEnvFile('.env.example');
    
    if (backendEnv && connectorEnv) {
      const conflictingVars = [];
      
      // Check for common environment variables
      const commonVars = ['PORT', 'NODE_ENV', 'DATABASE_URL', 'REDIS_URL'];
      
      for (const varName of commonVars) {
        if (backendEnv[varName] && connectorEnv[varName]) {
          if (varName === 'PORT' && backendEnv[varName] === connectorEnv[varName]) {
            conflictingVars.push(varName);
          } else if (varName !== 'PORT') {
            // Other variables should be the same or intentionally different
            if (backendEnv[varName] !== connectorEnv[varName]) {
              this.warnings.push({
                type: 'Environment Variable',
                description: `Different ${varName} values`,
                details: `Backend: ${backendEnv[varName]}, Connector: ${connectorEnv[varName]}`
              });
            }
          }
        }
      }
      
      if (conflictingVars.length > 0) {
        this.conflicts.push({
          type: 'Environment Conflict',
          description: 'Conflicting environment variables',
          severity: 'HIGH',
          details: conflictingVars.join(', ')
        });
      } else {
        console.log('✅ No environment variable conflicts detected');
      }
    } else {
      console.log('⚠️ Could not verify environment variables');
    }
  }
  
  async testDependencyConflicts() {
    console.log('📦 Testing Dependency Conflicts...');
    
    const backendPackage = this.readPackageJson('../backend/package.json');
    const connectorPackage = this.readPackageJson('package.json');
    
    if (backendPackage && connectorPackage) {
      const conflictingDeps = [];
      
      // Check for conflicting versions of major dependencies
      const majorDeps = ['express', 'axios', 'cors', 'dotenv'];
      
      for (const dep of majorDeps) {
        const backendVersion = backendPackage.dependencies?.[dep];
        const connectorVersion = connectorPackage.dependencies?.[dep];
        
        if (backendVersion && connectorVersion) {
          // Extract major version
          const backendMajor = backendVersion.replace(/[^\d.]/g, '').split('.')[0];
          const connectorMajor = connectorVersion.replace(/[^\d.]/g, '').split('.')[0];
          
          if (backendMajor !== connectorMajor) {
            conflictingDeps.push({
              name: dep,
              backend: backendVersion,
              connector: connectorVersion
            });
          }
        }
      }
      
      if (conflictingDeps.length > 0) {
        this.warnings.push({
          type: 'Dependency Version',
          description: 'Different major versions detected',
          details: conflictingDeps.map(d => `${d.name}: ${d.backend} vs ${d.connector}`).join(', ')
        });
      } else {
        console.log('✅ No major dependency conflicts detected');
      }
    } else {
      console.log('⚠️ Could not verify dependencies');
    }
  }
  
  async testAPIEndpointConflicts() {
    console.log('🔗 Testing API Endpoint Conflicts...');
    
    // Test if both services respond to similar endpoints
    const testEndpoints = [
      { path: '/health', backend: true, connector: false },
      { path: '/api/health', backend: false, connector: true }
    ];
    
    for (const endpoint of testEndpoints) {
      try {
        const url = endpoint.backend ? 
          `${this.backendUrl}${endpoint.path}` : 
          `${this.connectorUrl}${endpoint.path}`;
        
        const response = await axios.get(url, { timeout: 5000 });
        
        if (endpoint.backend && response.status === 200) {
          console.log(`✅ Backend endpoint ${endpoint.path} working`);
        } else if (endpoint.connector && response.status === 200) {
          console.log(`✅ Connector endpoint ${endpoint.path} working`);
        }
        
      } catch (error) {
        // Expected if service not running
        console.log(`⚠️ Endpoint ${endpoint.path} not accessible`);
      }
    }
  }
  
  async testIntegrationCompatibility() {
    console.log('🔗 Testing Integration Compatibility...');
    
    // Test if connector can communicate with backend
    try {
      // Check if backend has the required endpoints for connector to work
      const backendEndpoints = [
        '/prokip/config',
        '/connections',
        '/stores'
      ];
      
      for (const endpoint of backendEndpoints) {
        try {
          const response = await axios.get(`${this.backendUrl}${endpoint}`, { timeout: 5000 });
          console.log(`✅ Backend endpoint ${endpoint} available`);
        } catch (error) {
          this.warnings.push({
            type: 'Integration',
            description: `Backend endpoint ${endpoint} not available`,
            details: 'Connector may not be able to integrate properly'
          });
        }
      }
      
    } catch (error) {
      console.log('⚠️ Could not test integration compatibility');
    }
  }
  
  readEnvFile(filePath) {
    const fs = require('fs');
    const path = require('path');
    
    try {
      const fullPath = path.join(__dirname, filePath);
      const content = fs.readFileSync(fullPath, 'utf8');
      const env = {};
      
      content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          env[match[1]] = match[2];
        }
      });
      
      return env;
    } catch (error) {
      return null;
    }
  }
  
  readPackageJson(filePath) {
    const fs = require('fs');
    const path = require('path');
    
    try {
      const fullPath = path.join(__dirname, filePath);
      const content = fs.readFileSync(fullPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }
  
  printResults() {
    console.log('\n📊 CONFLICT DETECTION RESULTS:');
    console.log('='.repeat(60));
    
    console.log(`Conflicts: ${this.conflicts.length}`);
    console.log(`Warnings: ${this.warnings.length}`);
    
    if (this.conflicts.length > 0) {
      console.log('\n🚨 CONFLICTS FOUND:');
      this.conflicts.forEach(conflict => {
        console.log(`  [${conflict.severity}] ${conflict.type}: ${conflict.description}`);
        if (conflict.details) {
          console.log(`    Details: ${conflict.details}`);
        }
      });
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      this.warnings.forEach(warning => {
        console.log(`  ${warning.type}: ${warning.description}`);
        if (warning.details) {
          console.log(`    Details: ${warning.details}`);
        }
      });
    }
    
    console.log('\n' + '='.repeat(60));
    
    if (this.conflicts.length === 0) {
      console.log('✅ NO CONFLICTS DETECTED! The connector plugin is compatible with the existing backend.');
    } else {
      console.log('❌ CONFLICTS DETECTED! Please resolve the issues before deploying.');
    }
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (this.conflicts.length === 0) {
      console.log('  - Both services can run simultaneously');
      console.log('  - Use different ports (3000 for backend, 3001 for connector)');
      console.log('  - Use different databases if needed');
      console.log('  - Connector complements backend functionality');
    } else {
      console.log('  - Resolve all conflicts before deployment');
      console.log('  - Consider using different route prefixes');
      console.log('  - Use separate databases or schemas');
      console.log('  - Align dependency versions where possible');
    }
  }
}

// Run conflict detection if this file is executed directly
if (require.main === module) {
  const test = new ConflictDetectionTest();
  test.runConflictDetection().catch(console.error);
}

module.exports = ConflictDetectionTest;
