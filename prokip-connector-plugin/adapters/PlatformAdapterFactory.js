const WooCommerceAdapter = require('./WooCommerceAdapter');
const ShopifyAdapter = require('./ShopifyAdapter');
const CustomAdapter = require('./CustomAdapter');

class PlatformAdapterFactory {
  constructor() {
    this.adapters = new Map([
      ['woocommerce', new WooCommerceAdapter()],
      ['shopify', new ShopifyAdapter()],
      ['custom', new CustomAdapter()]
    ]);
  }
  
  /**
   * Get adapter for specific platform
   */
  getAdapter(platform) {
    const normalizedPlatform = platform.toLowerCase();
    
    if (!this.adapters.has(normalizedPlatform)) {
      throw new Error(`Unsupported platform: ${platform}. Supported platforms: ${Array.from(this.adapters.keys()).join(', ')}`);
    }
    
    return this.adapters.get(normalizedPlatform);
  }
  
  /**
   * Get all supported platforms
   */
  getSupportedPlatforms() {
    return Array.from(this.adapters.keys());
  }
  
  /**
   * Register a new platform adapter
   */
  registerAdapter(platform, adapter) {
    this.adapters.set(platform.toLowerCase(), adapter);
  }
  
  /**
   * Check if platform is supported
   */
  isSupported(platform) {
    return this.adapters.has(platform.toLowerCase());
  }
}

module.exports = PlatformAdapterFactory;
