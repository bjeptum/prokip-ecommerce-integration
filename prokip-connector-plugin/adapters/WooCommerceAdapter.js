class WooCommerceAdapter {
  constructor() {
    this.platform = 'woocommerce';
    this.requiredCredentialFields = ['api_key', 'api_secret'];
    this.optionalCredentialFields = ['store_url'];
  }
  
  /**
   * Validate WooCommerce credentials format
   */
  validateCredentials(credentials) {
    const errors = [];
    
    // Check required fields
    if (!credentials.api_key) {
      errors.push('api_key is required');
    } else if (!credentials.api_key.startsWith('ck_')) {
      errors.push('api_key must start with "ck_"');
    }
    
    if (!credentials.api_secret) {
      errors.push('api_secret is required');
    } else if (!credentials.api_secret.startsWith('cs_')) {
      errors.push('api_secret must start with "cs_"');
    }
    
    // Validate format
    if (credentials.api_key && credentials.api_key.length < 20) {
      errors.push('api_key appears to be too short');
    }
    
    if (credentials.api_secret && credentials.api_secret.length < 20) {
      errors.push('api_secret appears to be too short');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Normalize WooCommerce credentials for Prokip API
   */
  normalizeCredentials(credentials) {
    return {
      api_key: credentials.api_key.trim(),
      api_secret: credentials.api_secret.trim(),
      store_url: credentials.store_url ? credentials.store_url.trim().replace(/\/$/, '') : undefined
    };
  }
  
  /**
   * Test WooCommerce connection
   */
  async testConnection(storeUrl, credentials) {
    const axios = require('axios');
    
    try {
      const auth = Buffer.from(`${credentials.api_key}:${credentials.api_secret}`).toString('base64');
      
      const response = await axios.get(`${storeUrl}/wp-json/wc/v3/system_status`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      if (response.status === 200) {
        return {
          success: true,
          message: 'WooCommerce connection successful',
          details: {
            platform: 'woocommerce',
            version: response.data.environment?.woocommerce_version || 'unknown',
            store_url: storeUrl
          }
        };
      }
      
      return {
        success: false,
        error: 'Unexpected response from WooCommerce'
      };
      
    } catch (error) {
      let errorMessage = 'WooCommerce connection failed';
      
      if (error.response) {
        switch (error.response.status) {
          case 401:
            errorMessage = 'Invalid API credentials';
            break;
          case 403:
            errorMessage = 'Insufficient permissions';
            break;
          case 404:
            errorMessage = 'WooCommerce API not found. Check if REST API is enabled.';
            break;
          default:
            errorMessage = `HTTP ${error.response.status}: ${error.response.data?.message || 'Unknown error'}`;
        }
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Cannot connect to store. Check URL and network.';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'Store URL not found. Check domain name.';
      } else {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  
  /**
   * Fetch products from WooCommerce
   */
  async fetchProducts(storeUrl, credentials, options = {}) {
    const axios = require('axios');
    
    try {
      const auth = Buffer.from(`${credentials.api_key}:${credentials.api_secret}`).toString('base64');
      const { page = 1, per_page = 100, category = '', search = '' } = options;
      
      const params = {
        page,
        per_page,
        status: 'publish'
      };
      
      if (category) params.category = category;
      if (search) params.search = search;
      
      const response = await axios.get(`${storeUrl}/wp-json/wc/v3/products`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        params,
        timeout: 30000
      });
      
      // Transform products to Prokip format
      const products = response.data.map(product => this.transformProduct(product));
      
      return {
        success: true,
        products,
        total: response.headers['x-wp-total'] || products.length,
        totalPages: response.headers['x-wp-totalpages'] || 1
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
   * Fetch orders from WooCommerce
   */
  async fetchOrders(storeUrl, credentials, options = {}) {
    const axios = require('axios');
    
    try {
      const auth = Buffer.from(`${credentials.api_key}:${credentials.api_secret}`).toString('base64');
      const { 
        page = 1, 
        per_page = 100, 
        status = 'completed', 
        after = null,
        before = null 
      } = options;
      
      const params = {
        page,
        per_page,
        status
      };
      
      if (after) params.after = after;
      if (before) params.before = before;
      
      const response = await axios.get(`${storeUrl}/wp-json/wc/v3/orders`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        params,
        timeout: 30000
      });
      
      // Transform orders to Prokip format
      const orders = response.data.map(order => this.transformOrder(order));
      
      return {
        success: true,
        orders,
        total: response.headers['x-wp-total'] || orders.length,
        totalPages: response.headers['x-wp-totalpages'] || 1
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
   * Transform WooCommerce product to Prokip format
   */
  transformProduct(product) {
    return {
      external_id: product.id.toString(),
      name: product.name,
      description: product.description || '',
      sku: product.sku || '',
      price: parseFloat(product.price) || 0,
      regular_price: parseFloat(product.regular_price) || 0,
      sale_price: parseFloat(product.sale_price) || null,
      stock_quantity: product.stock_quantity || 0,
      manage_stock: product.manage_stock || false,
      stock_status: product.stock_status || 'instock',
      categories: product.categories?.map(cat => cat.name) || [],
      images: product.images?.map(img => img.src) || [],
      attributes: product.attributes || [],
      variations: product.variations?.map(variation => ({
        external_id: variation.id.toString(),
        sku: variation.sku || '',
        price: parseFloat(variation.price) || 0,
        stock_quantity: variation.stock_quantity || 0,
        attributes: variation.attributes || []
      })) || [],
      weight: parseFloat(product.weight) || 0,
      dimensions: {
        length: parseFloat(product.dimensions?.length) || 0,
        width: parseFloat(product.dimensions?.width) || 0,
        height: parseFloat(product.dimensions?.height) || 0
      },
      status: product.status,
      created_at: product.date_created,
      updated_at: product.date_modified,
      platform: 'woocommerce'
    };
  }
  
  /**
   * Transform WooCommerce order to Prokip format
   */
  transformOrder(order) {
    return {
      external_id: order.id.toString(),
      number: order.number,
      status: order.status,
      currency: order.currency,
      total: parseFloat(order.total) || 0,
      subtotal: parseFloat(order.total) || 0,
      tax_total: parseFloat(order.total_tax) || 0,
      shipping_total: parseFloat(order.shipping_total) || 0,
      customer: {
        first_name: order.billing?.first_name || '',
        last_name: order.billing?.last_name || '',
        email: order.billing?.email || '',
        phone: order.billing?.phone || '',
        company: order.billing?.company || ''
      },
      shipping_address: {
        first_name: order.shipping?.first_name || '',
        last_name: order.shipping?.last_name || '',
        company: order.shipping?.company || '',
        address_1: order.shipping?.address_1 || '',
        address_2: order.shipping?.address_2 || '',
        city: order.shipping?.city || '',
        state: order.shipping?.state || '',
        postcode: order.shipping?.postcode || '',
        country: order.shipping?.country || ''
      },
      line_items: order.line_items?.map(item => ({
        external_id: item.id.toString(),
        product_id: item.product_id?.toString() || '',
        variation_id: item.variation_id?.toString() || '',
        name: item.name,
        sku: item.sku || '',
        quantity: parseInt(item.quantity) || 0,
        price: parseFloat(item.price) || 0,
        total: parseFloat(item.total) || 0,
        tax_total: parseFloat(item.total_tax) || 0
      })) || [],
      created_at: order.date_created,
      updated_at: order.date_modified,
      platform: 'woocommerce'
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
          return 'Authentication failed. Check API credentials.';
        case 403:
          return 'Access denied. Insufficient permissions.';
        case 404:
          return 'Endpoint not found. Check WooCommerce REST API is enabled.';
        case 429:
          return 'Rate limit exceeded. Please try again later.';
        default:
          return data?.message || `HTTP ${status}: Unknown error`;
      }
    }
    
    return error.message || 'Unknown error occurred';
  }
}

module.exports = WooCommerceAdapter;
