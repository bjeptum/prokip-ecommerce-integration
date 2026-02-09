/**
 * UPDATED WOOCOMMERCE TO PROKIP MAPPER
 * Matches Laravel SellPosController::placeOrdersApi requirements exactly
 */

class WooCommerceToProkipMapper {
  constructor(options = {}) {
    this.skuMap = options.skuMap || null;
  }

  setSkuMap(map) {
    this.skuMap = map;
  }
  /**
   * Map WooCommerce order to Prokip E-commerce API format
   * Matches Laravel controller's $request->only(['products', 'customer_id', 'addresses'])
   * @param {Object} wooOrder - WooCommerce order data
   * @param {Object} connection - Connection details
   * @returns {Object} - Prokip-formatted order data
   */
  mapOrderToProkip(wooOrder, connection) {
    try {
      console.log('🔄 Mapping WooCommerce order to Prokip Laravel format...');
      
      // Extract customer_id from connection or create default
      const customerId = connection.prokipCustomerId || connection.userId || 1;
      
      // Build addresses object (Laravel expects specific structure)
      const addresses = this.mapAddresses(wooOrder);
      
      // Build products object keyed by variation_id (CRITICAL)
      const products = this.mapProductsAsObject(wooOrder.line_items || []);
      
      const prokipOrder = {
        customer_id: customerId,
        addresses: addresses,
        products: products
      };

      console.log('✅ Order mapped to Laravel format');
      console.log('📊 Mapped products count:', Object.keys(products).length);
      console.log('👤 Customer ID:', customerId);
      
      return prokipOrder;

    } catch (error) {
      console.error('❌ Error mapping order:', error.message);
      throw error;
    }
  }

  /**
   * Map addresses for Laravel controller
   * @param {Object} wooOrder - WooCommerce order
   * @returns {Object} - Addresses object
   */
  mapAddresses(wooOrder) {
    const customer = wooOrder.customer || {};
    const billing = wooOrder.billing || {};
    const shipping = wooOrder.shipping || billing;

    return {
      shipping: {
        name: `${customer.first_name || billing.first_name || 'Unknown'} ${customer.last_name || billing.last_name || 'Customer'}`.trim(),
        address: `${shipping.address_1 || billing.address_1 || ''} ${shipping.address_2 || billing.address_2 || ''}`.trim(),
        phone: customer.phone || billing.phone || shipping.phone || '',
        email: customer.email || billing.email || ''
      }
    };
  }

  /**
   * Map products as OBJECT keyed by variation_id (CRITICAL for Laravel)
   * @param {Array} lineItems - WooCommerce line items
   * @returns {Object} - Products object keyed by variation_id
   */
  mapProductsAsObject(lineItems) {
    const productsObject = {};
    
    lineItems.forEach(item => {
      // Skip items without SKU (we need variation_id)
      if (!item.sku) {
        console.log(`⚠️ Skipping item without SKU: ${item.name}`);
        return;
      }

      // Extract variation_id from SKU or metadata
      const variationId = this.extractVariationId(item);
      
      if (!variationId) {
        console.log(`⚠️ Skipping item without variation_id: ${item.name} (SKU: ${item.sku})`);
        return;
      }

      // Add to products object with variation_id as key
      productsObject[variationId] = {
        variation_id: parseInt(variationId),
        product_name: item.name || `Product ${variationId}`,
        quantity: parseInt(item.quantity) || 1
      };

      console.log(`✅ Mapped product: ${variationId} - ${item.name} (${item.quantity})`);
    });

    return productsObject;
  }

  /**
   * Extract variation_id from WooCommerce item
   * This needs to match your Prokip variation IDs
   * @param {Object} item - WooCommerce line item
   * @returns {string|null} - variation_id
   */
  extractVariationId(item) {
    const skuKey = (item?.sku || '').toString().trim().toLowerCase();

    // Method 0: Use SKU mapping from Prokip catalog first
    if (this.skuMap && skuKey && this.skuMap.has(skuKey)) {
      return this.skuMap.get(skuKey).toString();
    }

    // Method 1: Use SKU directly if it's numeric (variation_id)
    if (item.sku && /^\d+$/.test(item.sku)) {
      return item.sku;
    }

    // Method 2: Extract from metadata
    if (item.meta_data && item.meta_data.length > 0) {
      const variationMeta = item.meta_data.find(meta => 
        meta.key === 'variation_id' || meta.key === '_variation_id'
      );
      if (variationMeta && variationMeta.value) {
        return variationMeta.value.toString();
      }
    }

    // Method 3: Use product_id as fallback (if it matches variation_id)
    if (item.product_id && /^\d+$/.test(item.product_id.toString())) {
      return item.product_id.toString();
    }

    // Method 4: Map known SKUs to variation_ids (customize this)
    const skuToVariationMap = {
      '5014394': '45',  // Example: Polo shirt SKU -> variation_id
      '5554633': '46',  // Example: Maseli Dress SKU -> variation_id
      // Add your SKU to variation_id mappings here
    };

    if (skuToVariationMap[item.sku]) {
      return skuToVariationMap[item.sku];
    }

    return null;
  }

  /**
   * Validate mapped order against Laravel controller requirements
   * @param {Object} prokipOrder - Mapped order data
   * @returns {Object} - Validation result
   */
  validateForLaravel(prokipOrder) {
    const errors = [];
    const warnings = [];

    // Check required fields for Laravel controller
    if (!prokipOrder.customer_id) {
      errors.push('customer_id is required for Laravel controller');
    }

    if (!prokipOrder.addresses || typeof prokipOrder.addresses !== 'object') {
      errors.push('addresses object is required for Laravel controller');
    }

    if (!prokipOrder.products || typeof prokipOrder.products !== 'object') {
      errors.push('products object is required for Laravel controller');
    }

    // CRITICAL: Check if products is an object, not array
    if (Array.isArray(prokipOrder.products)) {
      errors.push('products must be an OBJECT keyed by variation_id, not an array');
    }

    // Validate each product in the object
    if (prokipOrder.products && typeof prokipOrder.products === 'object') {
      Object.keys(prokipOrder.products).forEach(key => {
        const product = prokipOrder.products[key];
        
        if (!product.variation_id) {
          errors.push(`Product ${key}: variation_id is required`);
        }
        
        if (!product.quantity || product.quantity <= 0) {
          errors.push(`Product ${key}: valid quantity is required`);
        }
        
        if (!product.product_name) {
          warnings.push(`Product ${key}: product_name is missing`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      payload: prokipOrder
    };
  }

  /**
   * Check if order should be synced to Prokip
   * @param {Object} wooOrder - WooCommerce order
   * @returns {boolean} - True if order should be synced
   */
  shouldSyncOrder(wooOrder) {
    const status = wooOrder.status || '';
    
    // Only sync orders that should reduce stock
    const syncableStatuses = ['processing', 'completed'];
    
    // Don't sync cancelled, failed, or refunded orders
    const ignoredStatuses = ['cancelled', 'failed', 'refunded', 'draft'];
    
    if (ignoredStatuses.includes(status)) {
      console.log(`⏭️ Ignoring order ${wooOrder.id} with status: ${status}`);
      return false;
    }

    if (!syncableStatuses.includes(status)) {
      console.log(`⏸️ Order ${wooOrder.id} status ${status} not ready for sync`);
      return false;
    }

    // Check if order has items that can be mapped
    const hasMappableItems = wooOrder.line_items?.some(item => {
      const variationId = this.extractVariationId(item);
      return !!variationId;
    });

    if (!hasMappableItems) {
      console.log(`⚠️ Order ${wooOrder.id} has no items with valid variation_id`);
      return false;
    }

    return true;
  }

  /**
   * Generate order notes for debugging
   * @param {Object} wooOrder - WooCommerce order
   * @returns {string} - Order notes
   */
  generateOrderNotes(wooOrder) {
    const notes = [];
    
    notes.push(`WooCommerce Order: ${wooOrder.order_number || wooOrder.id}`);
    notes.push(`Status: ${wooOrder.status}`);
    
    if (wooOrder.customer_note) {
      notes.push(`Customer Note: ${wooOrder.customer_note}`);
    }
    
    if (wooOrder.total) {
      notes.push(`Total: ${wooOrder.total}`);
    }

    return notes.join(' | ');
  }
}

module.exports = WooCommerceToProkipMapper;
