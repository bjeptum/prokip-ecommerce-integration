/**
 * WooCommerce Order to Prokip Stock Mapper
 * 
 * PURE MAPPER FUNCTION - No API calls, only data transformation
 * Fully testable in isolation
 * 
 * Maps WooCommerce order data to Prokip stock reduction payload
 * Following mapping priority: variation_id > product_id > sku
 */

/**
 * Map WooCommerce order to Prokip stock reduction payload
 * @param {Object} wooOrder - WooCommerce order object
 * @param {string} locationId - Prokip location ID
 * @returns {Object|null} - Prokip sell payload or null if invalid
 */
function mapWooOrderToProkipStock(wooOrder, locationId) {
  // Input validation
  if (!wooOrder || !locationId) {
    console.error('❌ Invalid input: wooOrder and locationId are required');
    return null;
  }

  if (!wooOrder.line_items || !Array.isArray(wooOrder.line_items)) {
    console.error('❌ Invalid order: no line_items array');
    return null;
  }

  // Extract order information
  const orderId = wooOrder.id?.toString();
  const orderNumber = wooOrder.number?.toString() || orderId;
  
  if (!orderId) {
    console.error('❌ Invalid order: missing order ID');
    return null;
  }

  // Map line items to Prokip sell lines
  const sellLines = [];
  let totalQuantity = 0;

  for (const lineItem of wooOrder.line_items) {
    const quantity = parseInt(lineItem.quantity) || 0;
    if (quantity <= 0) {
      console.log(`⚠️ Skipping item with invalid quantity: ${lineItem.name || 'Unknown'}`);
      continue;
    }

    // Product identifier mapping priority: variation_id > product_id > sku
    let productId = null;
    let identifier = null;
    let identifierType = null;

    if (lineItem.variation_id && lineItem.variation_id > 0) {
      productId = lineItem.variation_id.toString();
      identifier = productId;
      identifierType = 'variation_id';
    } else if (lineItem.product_id && lineItem.product_id > 0) {
      productId = lineItem.product_id.toString();
      identifier = productId;
      identifierType = 'product_id';
    } else if (lineItem.sku && lineItem.sku.trim()) {
      productId = lineItem.sku.trim();
      identifier = productId;
      identifierType = 'sku';
    }

    if (!productId) {
      console.log(`⚠️ Skipping item without valid identifier: ${lineItem.name || 'Unknown'}`);
      continue;
    }

    // Create sell line for Prokip
    const sellLine = {
      product_id: productId,
      quantity: quantity,
      unit_price: parseFloat(lineItem.price) || 0,
      line_total: parseFloat(lineItem.total) || 0,
      item_name: lineItem.name || `Product ${identifier}`,
      identifier_type: identifierType
    };

    sellLines.push(sellLine);
    totalQuantity += quantity;

    console.log(`📦 Mapped item: ${lineItem.name} (${identifierType}: ${identifier}) x${quantity}`);
  }

  if (sellLines.length === 0) {
    console.error('❌ No valid items found in order');
    return null;
  }

  // Calculate totals
  const totalAmount = parseFloat(wooOrder.total) || 0;
  const discountAmount = parseFloat(wooOrder.discount_total) || 0;

  // Create Prokip sell payload
  const prokipPayload = {
    location_id: parseInt(locationId),
    contact_id: 1, // Default customer for stock reduction
    transaction_date: wooOrder.date_created ? 
      new Date(wooOrder.date_created).toISOString().slice(0, 19).replace('T', ' ') :
      new Date().toISOString().slice(0, 19).replace('T', ' '),
    invoice_no: `WOO-${orderNumber}`,
    status: 'final',
    type: 'sell',
    payment_status: 'paid',
    final_total: totalAmount,
    discount_amount: discountAmount,
    discount_type: 'fixed',
    sells: sellLines,
    // Metadata for tracking
    woo_order_id: orderId,
    woo_order_number: orderNumber,
    total_items: sellLines.length,
    total_quantity: totalQuantity
  };

  console.log(`✅ Mapped WooCommerce order ${orderId} to Prokip stock payload:`);
  console.log(`  - Items: ${sellLines.length}`);
  console.log(`  - Total quantity: ${totalQuantity}`);
  console.log(`  - Total amount: ${totalAmount}`);

  return prokipPayload;
}

/**
 * Validate WooCommerce order status for stock reduction
 * @param {Object} wooOrder - WooCommerce order object
 * @returns {boolean} - True if order should trigger stock reduction
 */
function shouldReduceStock(wooOrder) {
  if (!wooOrder || !wooOrder.status) {
    console.log('⚠️ No order status provided');
    return false;
  }

  const status = wooOrder.status.toLowerCase();
  const financialStatus = wooOrder.financial_status?.toLowerCase();

  // Only process these statuses
  const allowedStatuses = ['processing', 'completed'];
  const allowedFinancialStatuses = ['paid', 'processing'];

  const statusAllowed = allowedStatuses.includes(status);
  const financialStatusAllowed = !financialStatus || allowedFinancialStatuses.includes(financialStatus);

  const shouldProcess = statusAllowed && financialStatusAllowed;

  console.log(`🔍 Order ${wooOrder.id} status check:`);
  console.log(`  - Status: ${status} (${statusAllowed ? '✅' : '❌'})`);
  console.log(`  - Financial status: ${financialStatus || 'N/A'} (${financialStatusAllowed ? '✅' : '❌'})`);
  console.log(`  - Should process: ${shouldProcess ? '✅' : '❌'}`);

  return shouldProcess;
}

/**
 * Extract product identifiers from WooCommerce line item
 * @param {Object} lineItem - WooCommerce line item
 * @returns {Object} - Product identifier info
 */
function extractProductIdentifier(lineItem) {
  let productId = null;
  let identifier = null;
  let identifierType = null;

  if (lineItem.variation_id && lineItem.variation_id > 0) {
    productId = lineItem.variation_id.toString();
    identifier = productId;
    identifierType = 'variation_id';
  } else if (lineItem.product_id && lineItem.product_id > 0) {
    productId = lineItem.product_id.toString();
    identifier = productId;
    identifierType = 'product_id';
  } else if (lineItem.sku && lineItem.sku.trim()) {
    productId = lineItem.sku.trim();
    identifier = productId;
    identifierType = 'sku';
  }

  return {
    productId,
    identifier,
    identifierType
  };
}

module.exports = {
  mapWooOrderToProkipStock,
  shouldReduceStock,
  extractProductIdentifier
};
