class CustomAdapter {
  constructor() {
    this.platform = 'custom';
    this.requiredCredentialFields = []; // Will be defined per implementation
    this.optionalCredentialFields = ['api_url', 'api_version'];
  }
  
  /**
   * Validate custom platform credentials
   * This is a base implementation - should be extended for specific custom platforms
   */
  validateCredentials(credentials) {
    const errors = [];
    
    // Base validation - check that we have some credentials
    if (!credentials || Object.keys(credentials).length === 0) {
      errors.push('At least one credential field is required');
    }
    
    // If api_url is provided, validate format
    if (credentials.api_url) {
      try {
        new URL(credentials.api_url);
      } catch (e) {
        errors.push('api_url must be a valid URL');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Normalize custom platform credentials
   */
  normalizeCredentials(credentials) {
    const normalized = {};
    
    // Copy all credentials, trimming string values
    Object.keys(credentials).forEach(key => {
      if (typeof credentials[key] === 'string') {
        normalized[key] = credentials[key].trim();
      } else {
        normalized[key] = credentials[key];
      }
    });
    
    return normalized;
  }
  
  /**
   * Test connection to custom platform
   * Base implementation - should be overridden for specific platforms
   */
  async testConnection(storeUrl, credentials) {
    const axios = require('axios');
    
    try {
      // Default health check - try to reach the API URL
      const apiUrl = credentials.api_url || storeUrl;
      
      const response = await axios.get(`${apiUrl}/health`, {
        timeout: 10000,
        headers: this.getAuthHeaders(credentials)
      });
      
      if (response.status === 200) {
        return {
          success: true,
          message: 'Custom platform connection successful',
          details: {
            platform: 'custom',
            api_url: apiUrl,
            version: response.data?.version || 'unknown',
            status: response.data?.status || 'connected'
          }
        };
      }
      
      return {
        success: false,
        error: 'Unexpected response from custom platform'
      };
      
    } catch (error) {
      return {
        success: false,
        error: this.formatApiError(error)
      };
    }
  }
  
  /**
   * Fetch products from custom platform
   * Base implementation - should be overridden for specific platforms
   */
  async fetchProducts(storeUrl, credentials, options = {}) {
    const axios = require('axios');
    
    try {
      const apiUrl = credentials.api_url || storeUrl;
      const { page = 1, limit = 100 } = options;
      
      const response = await axios.get(`${apiUrl}/products`, {
        headers: this.getAuthHeaders(credentials),
        params: { page, limit },
        timeout: 30000
      });
      
      // Transform products to Prokip format
      const products = (response.data.products || response.data).map(product => 
        this.transformProduct(product)
      );
      
      return {
        success: true,
        products,
        total: response.data.total || products.length,
        page: response.data.page || page
      };
      
    } catch (error) {
      return {
        success: false,
        error: this.formatApiError(error),
        products: []
      };
    }
  }
  
  /**
   * Fetch orders from custom platform
   * Base implementation - should be overridden for specific platforms
   */
  async fetchOrders(storeUrl, credentials, options = {}) {
    const axios = require('axios');
    
    try {
      const apiUrl = credentials.api_url || storeUrl;
      const { page = 1, limit = 100, status = 'completed' } = options;
      
      const response = await axios.get(`${apiUrl}/orders`, {
        headers: this.getAuthHeaders(credentials),
        params: { page, limit, status },
        timeout: 30000
      });
      
      // Transform orders to Prokip format
      const orders = (response.data.orders || response.data).map(order => 
        this.transformOrder(order)
      );
      
      return {
        success: true,
        orders,
        total: response.data.total || orders.length,
        page: response.data.page || page
      };
      
    } catch (error) {
      return {
        success: false,
        error: this.formatApiError(error),
        orders: []
      };
    }
  }
  
  /**
   * Get authentication headers based on credentials
   * Can be extended for different auth methods
   */
  getAuthHeaders(credentials) {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Prokip-Connector-Custom/1.0.0'
    };
    
    // Bearer token authentication
    if (credentials.access_token || credentials.api_key) {
      headers['Authorization'] = `Bearer ${credentials.access_token || credentials.api_key}`;
    }
    
    // Basic authentication
    if (credentials.username && credentials.password) {
      const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }
    
    // API key in header
    if (credentials.api_key && !credentials.access_token) {
      headers['X-API-Key'] = credentials.api_key;
    }
    
    // Custom headers
    if (credentials.custom_headers) {
      Object.assign(headers, credentials.custom_headers);
    }
    
    return headers;
  }
  
  /**
   * Transform custom product to Prokip format
   * Base implementation - can be extended for specific mappings
   */
  transformProduct(product) {
    return {
      external_id: (product.id || product.product_id || '').toString(),
      name: product.name || product.title || '',
      description: product.description || product.body_html || '',
      sku: product.sku || '',
      price: parseFloat(product.price || product.cost || 0),
      regular_price: parseFloat(product.regular_price || product.price || 0),
      sale_price: product.sale_price ? parseFloat(product.sale_price) : null,
      stock_quantity: parseInt(product.stock_quantity || product.inventory || product.quantity || 0),
      manage_stock: product.manage_stock || product.track_inventory || false,
      stock_status: product.stock_quantity > 0 ? 'instock' : 'outofstock',
      categories: Array.isArray(product.categories) ? product.categories : 
                  (product.category ? [product.category] : []),
      images: Array.isArray(product.images) ? product.images.map(img => img.src || img.url || img) : 
                  (product.image ? [product.image] : []),
      attributes: product.attributes || product.specifications || [],
      variations: Array.isArray(product.variations) ? product.variations.map(variation => ({
        external_id: (variation.id || variation.variant_id || '').toString(),
        sku: variation.sku || '',
        price: parseFloat(variation.price || 0),
        stock_quantity: parseInt(variation.stock_quantity || variation.inventory || 0),
        attributes: variation.attributes || []
      })) : [],
      weight: parseFloat(product.weight || 0),
      dimensions: {
        length: parseFloat(product.length || product.dimensions?.length || 0),
        width: parseFloat(product.width || product.dimensions?.width || 0),
        height: parseFloat(product.height || product.dimensions?.height || 0)
      },
      tags: product.tags ? (Array.isArray(product.tags) ? product.tags : product.tags.split(',')) : [],
      vendor: product.vendor || product.brand || '',
      product_type: product.product_type || product.type || '',
      status: product.status || 'active',
      created_at: product.created_at || product.date_created || new Date().toISOString(),
      updated_at: product.updated_at || product.date_updated || new Date().toISOString(),
      platform: 'custom',
      raw_data: product // Keep original data for debugging
    };
  }
  
  /**
   * Transform custom order to Prokip format
   * Base implementation - can be extended for specific mappings
   */
  transformOrder(order) {
    return {
      external_id: (order.id || order.order_id || '').toString(),
      number: order.number || order.order_number || order.id?.toString(),
      status: order.status || 'pending',
      currency: order.currency || 'USD',
      total: parseFloat(order.total || order.total_amount || order.amount || 0),
      subtotal: parseFloat(order.subtotal || order.subtotal_amount || 0),
      tax_total: parseFloat(order.tax_total || order.tax || 0),
      shipping_total: parseFloat(order.shipping_total || order.shipping || 0),
      customer: {
        first_name: order.customer?.first_name || order.billing?.first_name || order.first_name || '',
        last_name: order.customer?.last_name || order.billing?.last_name || order.last_name || '',
        email: order.customer?.email || order.billing?.email || order.email || '',
        phone: order.customer?.phone || order.billing?.phone || order.phone || '',
        company: order.customer?.company || order.billing?.company || order.company || ''
      },
      shipping_address: {
        first_name: order.shipping?.first_name || order.first_name || '',
        last_name: order.shipping?.last_name || order.last_name || '',
        company: order.shipping?.company || order.company || '',
        address_1: order.shipping?.address_1 || order.shipping?.address || order.address || '',
        address_2: order.shipping?.address_2 || order.address_2 || '',
        city: order.shipping?.city || order.city || '',
        state: order.shipping?.state || order.state || '',
        postcode: order.shipping?.postcode || order.shipping?.zip || order.postal_code || '',
        country: order.shipping?.country || order.country || ''
      },
      line_items: Array.isArray(order.line_items) ? order.line_items.map(item => ({
        external_id: (item.id || item.line_item_id || '').toString(),
        product_id: (item.product_id || item.product?.id || '').toString(),
        variant_id: (item.variant_id || item.variation_id || '').toString(),
        name: item.name || item.product_name || item.title || '',
        sku: item.sku || '',
        quantity: parseInt(item.quantity || item.qty || 0),
        price: parseFloat(item.price || item.unit_price || 0),
        total: parseFloat(item.total || item.line_total || 0),
        tax_total: parseFloat(item.tax_total || item.tax || 0)
      })) : [],
      tags: order.tags ? (Array.isArray(order.tags) ? order.tags : order.tags.split(',')) : [],
      created_at: order.created_at || order.date_created || new Date().toISOString(),
      updated_at: order.updated_at || order.date_updated || new Date().toISOString(),
      platform: 'custom',
      raw_data: order // Keep original data for debugging
    };
  }
  
  /**
   * Format API errors consistently
   */
  formatApiError(error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      switch (status) {
        case 401:
          return 'Authentication failed. Check credentials.';
        case 403:
          return 'Access denied. Insufficient permissions.';
        case 404:
          return 'Endpoint not found. Check API configuration.';
        case 422:
          return data?.message || data?.error || 'Invalid request format';
        case 429:
          return 'Rate limit exceeded. Please try again later.';
        default:
          return data?.message || data?.error || `HTTP ${status}: Unknown error`;
      }
    }
    
    return error.message || 'Unknown error occurred';
  }
}

module.exports = CustomAdapter;
