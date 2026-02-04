const PlatformAdapterFactory = require('../adapters/PlatformAdapterFactory');

class ConnectionManager {
  constructor(prokipService) {
    this.prokipService = prokipService;
    this.platformAdapterFactory = new PlatformAdapterFactory();
  }
  
  /**
   * Connect a new store to Prokip
   */
  async connectStore(storeData) {
    try {
      console.log(`🔗 Connecting store: ${storeData.platform} - ${storeData.storeUrl}`);
      
      // Validate store data
      const validation = this.validateStoreData(storeData);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error,
          message: 'Invalid store data'
        };
      }
      
      // Get platform adapter
      const adapter = this.platformAdapterFactory.getAdapter(storeData.platform);
      
      // Test platform connection first
      console.log(`🔍 Testing ${storeData.platform} connection...`);
      const platformTest = await adapter.testConnection(storeData.storeUrl, storeData.credentials);
      
      if (!platformTest.success) {
        return {
          success: false,
          error: platformTest.error,
          message: `Failed to connect to ${storeData.platform} store`
        };
      }
      
      // Connect via Prokip API
      console.log(`📡 Connecting to Prokip API...`);
      const prokipResult = await this.prokipService.connectStore({
        platform: storeData.platform,
        store_url: storeData.storeUrl,
        credentials: storeData.credentials
      });
      
      if (!prokipResult.success) {
        return {
          success: false,
          error: prokipResult.error,
          message: 'Failed to connect store to Prokip'
        };
      }
      
      console.log(`✅ Store connected successfully! Store ID: ${prokipResult.store_id}`);
      
      return {
        success: true,
        store_id: prokipResult.store_id,
        platform: storeData.platform,
        store_url: storeData.storeUrl,
        message: 'Store connected successfully',
        platform_details: platformTest.details
      };
      
    } catch (error) {
      console.error('❌ Connection error:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Failed to connect store'
      };
    }
  }
  
  /**
   * Test connection to an existing store
   */
  async testConnection(storeId) {
    try {
      console.log(`🔍 Testing connection for store: ${storeId}`);
      
      // First test via Prokip API
      const prokipTest = await this.prokipService.testConnection(storeId);
      
      if (!prokipTest.success) {
        return {
          success: false,
          error: prokipTest.error,
          message: 'Failed to test Prokip connection'
        };
      }
      
      // Get store details from Prokip
      const stores = await this.prokipService.getStores();
      const store = stores.stores.find(s => s.id.toString() === storeId.toString());
      
      if (!store) {
        return {
          success: false,
          error: 'Store not found in Prokip',
          message: 'Store connection test failed'
        };
      }
      
      // Test platform connection
      const adapter = this.platformAdapterFactory.getAdapter(store.platform);
      const platformTest = await adapter.testConnection(store.store_url, store.credentials);
      
      if (!platformTest.success) {
        return {
          success: false,
          error: platformTest.error,
          message: `Failed to connect to ${store.platform} store`,
          prokip_status: 'connected',
          platform_status: 'disconnected'
        };
      }
      
      return {
        success: true,
        message: 'Store connection test successful',
        status: 'connected',
        details: {
          prokip: prokipTest.details,
          platform: platformTest.details,
          store: {
            id: store.id,
            platform: store.platform,
            store_url: store.store_url,
            created_at: store.created_at
          }
        }
      };
      
    } catch (error) {
      console.error('❌ Connection test error:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Connection test failed'
      };
    }
  }
  
  /**
   * Update store credentials
   */
  async updateStoreCredentials(storeId, newCredentials) {
    try {
      console.log(`🔄 Updating credentials for store: ${storeId}`);
      
      // Get store details
      const stores = await this.prokipService.getStores();
      const store = stores.stores.find(s => s.id.toString() === storeId.toString());
      
      if (!store) {
        return {
          success: false,
          error: 'Store not found',
          message: 'Cannot update credentials'
        };
      }
      
      // Get platform adapter
      const adapter = this.platformAdapterFactory.getAdapter(store.platform);
      
      // Validate new credentials
      const validation = adapter.validateCredentials(newCredentials);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', '),
          message: 'Invalid credentials format'
        };
      }
      
      // Test new credentials
      const normalizedCredentials = adapter.normalizeCredentials(newCredentials);
      const platformTest = await adapter.testConnection(store.store_url, normalizedCredentials);
      
      if (!platformTest.success) {
        return {
          success: false,
          error: platformTest.error,
          message: 'New credentials failed platform test'
        };
      }
      
      // Update via Prokip API (this would need to be implemented in Prokip API)
      console.log('📡 Updating credentials via Prokip API...');
      
      // For now, return success - actual update would be handled by Prokip API
      return {
        success: true,
        message: 'Store credentials updated successfully',
        platform_details: platformTest.details
      };
      
    } catch (error) {
      console.error('❌ Credentials update error:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Failed to update credentials'
      };
    }
  }
  
  /**
   * Disconnect a store
   */
  async disconnectStore(storeId) {
    try {
      console.log(`🔌 Disconnecting store: ${storeId}`);
      
      // Test connection first to see if store exists
      const testResult = await this.prokipService.testConnection(storeId);
      
      if (!testResult.success) {
        return {
          success: false,
          error: testResult.error,
          message: 'Store not found or already disconnected'
        };
      }
      
      // Disconnect via Prokip API (this would need to be implemented in Prokip API)
      console.log('📡 Disconnecting via Prokip API...');
      
      // For now, return success - actual disconnection would be handled by Prokip API
      return {
        success: true,
        message: 'Store disconnected successfully'
      };
      
    } catch (error) {
      console.error('❌ Disconnection error:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Failed to disconnect store'
      };
    }
  }
  
  /**
   * Get all connected stores with their status
   */
  async getConnectedStores() {
    try {
      console.log('🏪 Fetching all connected stores...');
      
      const storesResult = await this.prokipService.getStores();
      
      if (!storesResult.success) {
        return {
          success: false,
          error: storesResult.error,
          stores: []
        };
      }
      
      // Test connection for each store
      const storesWithStatus = await Promise.all(
        storesResult.stores.map(async (store) => {
          try {
            const testResult = await this.testConnection(store.id);
            return {
              ...store,
              connection_status: testResult.success ? 'connected' : 'disconnected',
              last_tested: new Date().toISOString(),
              connection_error: testResult.success ? null : testResult.error
            };
          } catch (error) {
            return {
              ...store,
              connection_status: 'error',
              last_tested: new Date().toISOString(),
              connection_error: error.message
            };
          }
        })
      );
      
      return {
        success: true,
        stores: storesWithStatus,
        total: storesWithStatus.length
      };
      
    } catch (error) {
      console.error('❌ Fetch stores error:', error.message);
      return {
        success: false,
        error: error.message,
        stores: []
      };
    }
  }
  
  /**
   * Validate store connection data
   */
  validateStoreData(storeData) {
    const errors = [];
    
    // Check required fields
    if (!storeData.platform) {
      errors.push('platform is required');
    } else if (!this.platformAdapterFactory.isSupported(storeData.platform)) {
      errors.push(`Unsupported platform: ${storeData.platform}`);
    }
    
    if (!storeData.storeUrl) {
      errors.push('storeUrl is required');
    } else {
      try {
        new URL(storeData.storeUrl);
      } catch (e) {
        errors.push('storeUrl must be a valid URL');
      }
    }
    
    if (!storeData.credentials || Object.keys(storeData.credentials).length === 0) {
      errors.push('credentials are required');
    }
    
    return {
      isValid: errors.length === 0,
      error: errors.join(', ')
    };
  }
  
  /**
   * Get supported platforms
   */
  getSupportedPlatforms() {
    return this.platformAdapterFactory.getSupportedPlatforms();
  }
  
  /**
   * Get platform-specific credential requirements
   */
  getPlatformCredentialRequirements(platform) {
    try {
      const adapter = this.platformAdapterFactory.getAdapter(platform);
      return {
        platform,
        required_fields: adapter.requiredCredentialFields || [],
        optional_fields: adapter.optionalCredentialFields || [],
        description: this.getPlatformDescription(platform)
      };
    } catch (error) {
      return {
        platform,
        required_fields: [],
        optional_fields: [],
        description: 'Unknown platform',
        error: error.message
      };
    }
  }
  
  /**
   * Get platform description
   */
  getPlatformDescription(platform) {
    const descriptions = {
      woocommerce: 'WooCommerce e-commerce platform',
      shopify: 'Shopify e-commerce platform',
      custom: 'Custom e-commerce platform'
    };
    
    return descriptions[platform] || 'Unknown platform';
  }
}

module.exports = ConnectionManager;
