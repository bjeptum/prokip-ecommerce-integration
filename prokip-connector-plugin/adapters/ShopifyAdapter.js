class ShopifyAdapter {
  constructor() {
    this.platform = 'shopify';
    this.requiredCredentialFields = ['access_token', 'shop_domain'];
    this.optionalCredentialFields = [];
  }
  
  /**
   * Validate Shopify credentials format
   */
  validateCredentials(credentials) {
    const errors = [];
    
    // Check required fields
    if (!credentials.access_token) {
      errors.push('access_token is required');
    } else if (!credentials.access_token.startsWith('shpat_')) {
      errors.push('access_token must start with "shpat_"');
    }
    
    if (!credentials.shop_domain) {
      errors.push('shop_domain is required');
    } else {
      // Validate shop domain format
      const domain = credentials.shop_domain.trim();
      if (!domain.includes('.myshopify.com') && !domain.match(/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/)) {
        errors.push('shop_domain must be a valid Shopify domain (e.g., store.myshopify.com)');
      }
    }
    
    // Validate format
    if (credentials.access_token && credentials.access_token.length < 30) {
      errors.push('access_token appears to be too short');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Normalize Shopify credentials for Prokip API
   */
  normalizeCredentials(credentials) {
    let shopDomain = credentials.shop_domain.trim();
    
    // Ensure shop domain includes .myshopify.com
    if (!shopDomain.includes('.myshopify.com')) {
      shopDomain = `${shopDomain}.myshopify.com`;
    }
    
    return {
      access_token: credentials.access_token.trim(),
      shop_domain: shopDomain
    };
  }
  
  /**
   * Test Shopify connection
   */
  async testConnection(storeUrl, credentials) {
    const axios = require('axios');
    
    try {
      const shopDomain = credentials.shop_domain;
      const accessToken = credentials.access_token;
      
      const response = await axios.get(`https://${shopDomain}/admin/api/2023-10/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      if (response.status === 200 && response.data.shop) {
        return {
          success: true,
          message: 'Shopify connection successful',
          details: {
            platform: 'shopify',
            shop_name: response.data.shop.name,
            shop_domain: shopDomain,
            currency: response.data.shop.currency,
            plan_name: response.data.shop.plan_name
          }
        };
      }
      
      return {
        success: false,
        error: 'Unexpected response from Shopify'
      };
      
    } catch (error) {
      let errorMessage = 'Shopify connection failed';
      
      if (error.response) {
        switch (error.response.status) {
          case 401:
            errorMessage = 'Invalid access token';
            break;
          case 403:
            errorMessage = 'Insufficient permissions for this scope';
            break;
          case 404:
            errorMessage = 'Shop not found. Check shop domain.';
            break;
          case 422:
            errorMessage = 'Invalid request format';
            break;
          default:
            errorMessage = `HTTP ${error.response.status}: ${error.response.data?.errors || 'Unknown error'}`;
        }
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Cannot connect to Shopify. Check network connection.';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'Shop domain not found. Check domain name.';
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
   * Fetch products from Shopify
   */
  async fetchProducts(storeUrl, credentials, options = {}) {
    const axios = require('axios');
    
    try {
      const shopDomain = credentials.shop_domain;
      const accessToken = credentials.access_token;
      const { 
        page = 1, 
        limit = 250, 
        collection_id = null,
        product_type = '',
        vendor = '',
        created_at_min = null,
        created_at_max = null
      } = options;
      
      const params = {
        limit: Math.min(limit, 250), // Shopify max limit
        fields: 'id,title,handle,description,body_html,product_type,vendor,variants,options,images,created_at,updated_at,status,tags'
      };
      
      if (collection_id) params.collection_id = collection_id;
      if (product_type) params.product_type = product_type;
      if (vendor) params.vendor = vendor;
      if (created_at_min) params.created_at_min = created_at_min;
      if (created_at_max) params.created_at_max = created_at_max;
      
      // Add pagination info
      if (page > 1) {
        params.page_info = page; // Shopify uses page_info for pagination
      }
      
      const response = await axios.get(`https://${shopDomain}/admin/api/2023-10/products.json`, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        params,
        timeout: 30000
      });
      
      // Transform products to Prokip format
      const products = response.data.products.map(product => this.transformProduct(product));
      
      return {
        success: true,
        products,
        total: products.length,
        hasMore: response.headers.link && response.headers.link.includes('rel="next"')
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
   * Fetch orders from Shopify
   */
  async fetchOrders(storeUrl, credentials, options = {}) {
    const axios = require('axios');
    
    try {
      const shopDomain = credentials.shop_domain;
      const accessToken = credentials.access_token;
      const { 
        page = 1, 
        limit = 250, 
        status = 'any',
        financial_status = 'any',
        fulfillment_status = 'any',
        created_at_min = null,
        created_at_max = null,
        processed_at_min = null,
        processed_at_max = null
      } = options;
      
      const params = {
        limit: Math.min(limit, 250),
        status,
        financial_status,
        fulfillment_status,
        fields: 'id,name,total_price,subtotal_price,total_tax,total_shipping_price_set,currency,customer,billing_address,shipping_address,line_items,created_at,updated_at,processed_at,financial_status,fulfillment_status,tags'
      };
      
      if (created_at_min) params.created_at_min = created_at_min;
      if (created_at_max) params.created_at_max = created_at_max;
      if (processed_at_min) params.processed_at_min = processed_at_min;
      if (processed_at_max) params.processed_at_max = processed_at_max;
      
      const response = await axios.get(`https://${shopDomain}/admin/api/2023-10/orders.json`, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        params,
        timeout: 30000
      });
      
      // Transform orders to Prokip format
      const orders = response.data.orders.map(order => this.transformOrder(order));
      
      return {
        success: true,
        orders,
        total: orders.length,
        hasMore: response.headers.link && response.headers.link.includes('rel="next"')
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
   * Transform Shopify product to Prokip format
   */
  transformProduct(product) {
    // Find the first variant as the main product
    const mainVariant = product.variants?.[0] || {};
    
    return {
      external_id: product.id.toString(),
      name: product.title,
      description: product.body_html || product.description || '',
      sku: mainVariant.sku || '',
      price: parseFloat(mainVariant.price) || 0,
      regular_price: parseFloat(mainVariant.compare_at_price) || parseFloat(mainVariant.price) || 0,
      sale_price: mainVariant.compare_at_price ? parseFloat(mainVariant.price) : null,
      stock_quantity: mainVariant.inventory_quantity || 0,
      manage_stock: mainVariant.inventory_management === 'shopify',
      stock_status: mainVariant.inventory_quantity > 0 ? 'instock' : 'outofstock',
      categories: [product.product_type].filter(Boolean),
      images: product.images?.map(img => img.src) || [],
      attributes: product.options?.map(option => ({
        name: option.name,
        values: option.values || []
      })) || [],
      variations: product.variants?.map(variant => ({
        external_id: variant.id.toString(),
        sku: variant.sku || '',
        price: parseFloat(variant.price) || 0,
        regular_price: parseFloat(variant.compare_at_price) || parseFloat(variant.price) || 0,
        sale_price: variant.compare_at_price ? parseFloat(variant.price) : null,
        stock_quantity: variant.inventory_quantity || 0,
        manage_stock: variant.inventory_management === 'shopify',
        title: variant.title,
        option1: variant.option1,
        option2: variant.option2,
        option3: variant.option3,
        attributes: product.options?.map(option => ({
          name: option.name,
          value: variant[`option${option.position}`] || ''
        })) || []
      })) || [],
      weight: parseFloat(mainVariant.weight) || 0,
      dimensions: {
        length: parseFloat(mainVariant.length) || 0,
        width: parseFloat(mainVariant.width) || 0,
        height: parseFloat(mainVariant.height) || 0
      },
      tags: product.tags ? product.tags.split(',').map(tag => tag.trim()) : [],
      vendor: product.vendor || '',
      product_type: product.product_type || '',
      handle: product.handle,
      status: product.status,
      created_at: product.created_at,
      updated_at: product.updated_at,
      platform: 'shopify'
    };
  }
  
  /**
   * Transform Shopify order to Prokip format
   */
  transformOrder(order) {
    return {
      external_id: order.id.toString(),
      number: order.name || order.order_number?.toString(),
      status: order.financial_status || 'pending',
      currency: order.currency,
      total: parseFloat(order.total_price) || 0,
      subtotal: parseFloat(order.subtotal_price) || 0,
      tax_total: parseFloat(order.total_tax) || 0,
      shipping_total: parseFloat(order.total_shipping_price_set?.shop_money?.amount) || 0,
      customer: {
        first_name: order.customer?.first_name || order.billing_address?.first_name || '',
        last_name: order.customer?.last_name || order.billing_address?.last_name || '',
        email: order.customer?.email || order.billing_address?.email || '',
        phone: order.customer?.phone || order.billing_address?.phone || '',
        company: order.customer?.company || order.billing_address?.company || ''
      },
      shipping_address: {
        first_name: order.shipping_address?.first_name || '',
        last_name: order.shipping_address?.last_name || '',
        company: order.shipping_address?.company || '',
        address_1: order.shipping_address?.address1 || '',
        address_2: order.shipping_address?.address2 || '',
        city: order.shipping_address?.city || '',
        state: order.shipping_address?.province || '',
        postcode: order.shipping_address?.zip || '',
        country: order.shipping_address?.country || ''
      },
      billing_address: {
        first_name: order.billing_address?.first_name || '',
        last_name: order.billing_address?.last_name || '',
        company: order.billing_address?.company || '',
        address_1: order.billing_address?.address1 || '',
        address_2: order.billing_address?.address2 || '',
        city: order.billing_address?.city || '',
        state: order.billing_address?.province || '',
        postcode: order.billing_address?.zip || '',
        country: order.billing_address?.country || ''
      },
      line_items: order.line_items?.map(item => ({
        external_id: item.id.toString(),
        product_id: item.product_id?.toString() || '',
        variant_id: item.variant_id?.toString() || '',
        name: item.name,
        sku: item.sku || '',
        quantity: parseInt(item.quantity) || 0,
        price: parseFloat(item.price) || 0,
        total: parseFloat(item.total_discount || 0) > 0 
          ? parseFloat(item.price) * parseInt(item.quantity) - parseFloat(item.total_discount)
          : parseFloat(item.price) * parseInt(item.quantity),
        tax_total: parseFloat(item.tax_lines?.reduce((sum, tax) => sum + parseFloat(tax.price), 0) || 0),
        vendor: item.vendor || '',
        product_type: item.product_type || ''
      })) || [],
      tags: order.tags ? order.tags.split(',').map(tag => tag.trim()) : [],
      fulfillment_status: order.fulfillment_status,
      financial_status: order.financial_status,
      created_at: order.created_at,
      updated_at: order.updated_at,
      processed_at: order.processed_at,
      platform: 'shopify'
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
          return 'Authentication failed. Check access token.';
        case 403:
          return 'Access denied. Insufficient permissions or missing scopes.';
        case 404:
          return 'Resource not found. Check shop domain and permissions.';
        case 422:
          return data?.errors ? Object.values(data.errors).flat().join(', ') : 'Invalid request format';
        case 429:
          return 'Rate limit exceeded. Please try again later.';
        default:
          return data?.errors || `HTTP ${status}: Unknown error`;
      }
    }
    
    return error.message || 'Unknown error occurred';
  }
}

module.exports = ShopifyAdapter;
