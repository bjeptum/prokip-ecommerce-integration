const prokipEcomClient = require('./prokipEcomClient');
const { shouldReduceStock } = require('./wooToProkipStockMapper');
const prisma = require('../lib/prisma');
const prokipLocalAuthService = require('./prokipLocalAuthService');

const SKU_MAP_TTL_MS = 5 * 60 * 1000;
const skuMapCache = new Map();

function normalizeSku(sku) {
  return (sku || '').toString().trim().toLowerCase();
}

function buildInvoiceNumber(platform, orderNumber = null, orderId = null) {
  const prefixMap = {
    woocommerce: 'woo',
    shopify: 'shop',
    prokip: 'prokip'
  };

  const prefix = prefixMap[(platform || '').toLowerCase()] || 'eco';
  const core = (orderNumber || orderId || Date.now()).toString().replace(/[^a-zA-Z0-9]/g, '');
  return `${prefix}${core}`;
}

function extractProductsFromResponse(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
}

async function fetchAllProkipProducts(userId, storeId = null) {
  if (process.env.PROKIP_LOCAL_AUTH === 'true') {
    return [];
  }

  const products = [];
  const limit = 100;
  let page = 1;
  let lastPage = 1;

  while (page <= lastPage) {
    const params = { limit, page };
    if (storeId) params.store_id = storeId;
    const response = await prokipEcomClient.getProducts(params, userId);
    const pageProducts = extractProductsFromResponse(response);
    products.push(...pageProducts);

    const responseLastPage =
      response?.last_page ||
      response?.meta?.last_page ||
      response?.data?.meta?.last_page;

    if (responseLastPage) {
      lastPage = responseLastPage;
      page += 1;
    } else {
      break;
    }
  }

  return products;
}

function getPrimaryVariationId(product) {
  const firstVariation =
    product?.product_variations?.[0]?.variations?.[0] ||
    product?.product_variations?.[0]?.variations?.[0];
  return firstVariation?.id || product?.id || null;
}

function buildSkuMap(products) {
  const map = new Map();

  products.forEach((product) => {
    const productSku = normalizeSku(product?.sku);
    const primaryVariationId = getPrimaryVariationId(product);

    if (productSku && primaryVariationId) {
      map.set(productSku, primaryVariationId);
    }

    const variations = product?.product_variations || [];
    variations.forEach((variationGroup) => {
      const variationItems = variationGroup?.variations || [];
      variationItems.forEach((variation) => {
        const variationSku = normalizeSku(variation?.sub_sku || variation?.sku);
        if (variationSku && variation?.id) {
          map.set(variationSku, variation.id);
        }
      });
    });
  });

  return map;
}

async function getSkuMapForUser(userId, storeId = null) {
  const useLocalProkip = process.env.PROKIP_LOCAL_AUTH === 'true';

  if (useLocalProkip) {
    const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : null;
    const locationId = config?.locationId || 'default';
    const cacheKey = `local:${locationId}`;

    const cached = skuMapCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) return cached.map;

    const map = await prokipLocalAuthService.getSkuVariationMap(locationId);

    skuMapCache.set(cacheKey, {
      map,
      expiresAt: now + SKU_MAP_TTL_MS
    });

    return map;
  }

  const cacheKey = `${userId || 'anon'}:${storeId || 'default'}`;
  const cached = skuMapCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.map;

  const products = await fetchAllProkipProducts(userId, storeId);
  const map = buildSkuMap(products);

  skuMapCache.set(cacheKey, {
    map,
    expiresAt: now + SKU_MAP_TTL_MS
  });

  return map;
}

function mapAddresses(wooOrder) {
  const customer = wooOrder?.customer || {};
  const billing = wooOrder?.billing || {};
  const shipping = wooOrder?.shipping || billing;

  return {
    shipping: {
      name: `${customer.first_name || billing.first_name || 'Unknown'} ${customer.last_name || billing.last_name || 'Customer'}`.trim(),
      address: `${shipping.address_1 || billing.address_1 || ''} ${shipping.address_2 || billing.address_2 || ''}`.trim(),
      phone: customer.phone || billing.phone || shipping.phone || '',
      email: customer.email || billing.email || ''
    }
  };
}

function mapWooOrderToProkipOrder(wooOrder, skuMap, connection) {
  const products = {};
  const itemMap = new Map();
  const missing = [];

  (wooOrder?.line_items || []).forEach((item) => {
    const skuKey = normalizeSku(item?.sku);
    const variationIdKey = normalizeSku(item?.variation_id);
    const productIdKey = normalizeSku(item?.product_id);
    const quantity = parseInt(item?.quantity, 10) || 0;

    const lookupKeys = [skuKey, variationIdKey, productIdKey].filter(Boolean);

    if (lookupKeys.length === 0) {
      missing.push({ name: item?.name || 'Unknown', reason: 'missing_sku' });
      return;
    }

    let mapped = null;
    for (const candidate of lookupKeys) {
      if (skuMap.has(candidate)) {
        mapped = skuMap.get(candidate);
        break;
      }
    }

    const variationId =
      typeof mapped === 'object'
        ? mapped?.variation_id
        : mapped;
    if (!variationId) {
      missing.push({
        sku: item?.sku || null,
        product_id: item?.product_id || null,
        variation_id: item?.variation_id || null,
        reason: 'no_prokip_match'
      });
      return;
    }

    if (quantity <= 0) {
      return;
    }

    const variationKey = variationId.toString();
    const existing = itemMap.get(variationKey);

    if (existing) {
      existing.quantity += quantity;
    } else {
      itemMap.set(variationKey, {
        variation_id: parseInt(variationId, 10),
        quantity: quantity,
        sku: item?.sku || null,
        product_name: item?.name || `Product ${variationId}`,
        product_id: typeof mapped === 'object' ? mapped?.product_id : null,
        product_variation_id: typeof mapped === 'object' ? mapped?.product_variation_id : null
      });
    }
  });

  const items = Array.from(itemMap.values());
  items.forEach((item) => {
    products[item.variation_id] = {
      variation_id: item.variation_id,
      product_name: item.product_name,
      quantity: item.quantity,
      sku: item.sku || null
    };
  });

  const customerId = connection?.prokipCustomerId || connection?.userId || 1;

  const totalQuantity = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  const invoiceNo = buildInvoiceNumber('woocommerce', wooOrder?.number, wooOrder?.id);

  return {
    payload: {
      customer_id: customerId,
      addresses: mapAddresses(wooOrder),
      products,
      invoice_no: invoiceNo,
      source_platform: 'woocommerce',
      source_order_number: wooOrder?.number || wooOrder?.id
    },
    items,
    missing,
    invoiceNo,
    totalQuantity
  };
}

async function syncWooOrderToProkip(wooOrder, connection, userId) {
  if (!wooOrder) {
    return { success: false, error: 'Missing WooCommerce order data' };
  }

  if (!shouldReduceStock(wooOrder)) {
    return { success: true, action: 'skipped', reason: 'status_not_eligible' };
  }

  const skuMap = await getSkuMapForUser(userId, connection?.id || null);
  const { payload, items, missing, invoiceNo, totalQuantity } = mapWooOrderToProkipOrder(wooOrder, skuMap, connection);

  if (!items || items.length === 0) {
    return {
      success: false,
      error: 'No mappable SKUs found for this order',
      missing
    };
  }

  if (process.env.PROKIP_LOCAL_AUTH === 'true') {
    const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : null;
    const locationId = config?.locationId ? parseInt(config.locationId, 10) : null;
    if (!locationId) {
      return { success: false, error: 'Missing Prokip business location for this user' };
    }

    // Try to create the sale through Prokip-2 API so an invoice shows up in Prokip.
    let prokipOrder = null;
    try {
      prokipOrder = await prokipEcomClient.createOrder(payload, userId);
    } catch (err) {
      prokipOrder = { success: false, error: err.message };
    }

    const deduction = await prokipLocalAuthService.deductStockForVariations(locationId, items);

    return {
      success: true,
      response: {
        success: true,
        message: 'Stock deducted in Prokip (local DB)',
        locationId,
        updated: deduction.updated,
        inserted: deduction.inserted,
        deducted_lines: items.length
      },
      prokip_order: prokipOrder,
      missing,
      mappedCount: items.length,
      invoiceNo,
      totalQuantity
    };
  }

  const response = await prokipEcomClient.createOrder(payload, userId);

  return {
    success: true,
    response,
    missing,
    mappedCount: items.length,
    invoiceNo,
    totalQuantity
  };
}

function shouldProcessShopifyOrder(order) {
  const financialStatus = (order?.financial_status || '').toLowerCase();
  const cancelled = order?.cancelled_at || order?.cancel_reason;
  if (cancelled) return false;
  return ['paid', 'partially_paid', 'partially_refunded', 'authorized'].includes(financialStatus);
}

function mapShopifyOrderToProkipOrder(order, skuMap, connection) {
  const products = {};
  const itemMap = new Map();
  const missing = [];

  (order?.line_items || []).forEach((item) => {
    const skuKey = normalizeSku(item?.sku);
    const variantKey = normalizeSku(item?.variant_id);
    const productKey = normalizeSku(item?.product_id);
    const quantity = parseInt(item?.quantity, 10) || 0;

    const lookupKeys = [skuKey, variantKey, productKey].filter(Boolean);
    if (!lookupKeys.length || quantity <= 0) return;

    let mapped = null;
    for (const candidate of lookupKeys) {
      if (skuMap.has(candidate)) {
        mapped = skuMap.get(candidate);
        break;
      }
    }

    const variationId = typeof mapped === 'object' ? mapped?.variation_id : mapped;
    if (!variationId) {
      missing.push({
        sku: item?.sku || null,
        product_id: item?.product_id || null,
        variant_id: item?.variant_id || null,
        reason: 'no_prokip_match'
      });
      return;
    }

    const key = variationId.toString();
    const existing = itemMap.get(key);
    if (existing) {
      existing.quantity += quantity;
    } else {
      itemMap.set(key, {
        variation_id: parseInt(variationId, 10),
        quantity,
        sku: item?.sku || null,
        product_name: item?.title || `Product ${variationId}`,
        product_id: typeof mapped === 'object' ? mapped?.product_id : null,
        product_variation_id: typeof mapped === 'object' ? mapped?.product_variation_id : null
      });
    }
  });

  const items = Array.from(itemMap.values());
  items.forEach((item) => {
    products[item.variation_id] = {
      variation_id: item.variation_id,
      product_name: item.product_name,
      quantity: item.quantity,
      sku: item.sku || null
    };
  });

  const customerId = connection?.prokipCustomerId || connection?.userId || 1;
  const invoiceNo = buildInvoiceNumber('shopify', order?.order_number, order?.id);
  const totalQuantity = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);

  return {
    payload: {
      customer_id: customerId,
      addresses: {
        shipping: {
          name: `${order?.shipping_address?.first_name || ''} ${order?.shipping_address?.last_name || ''}`.trim(),
          address: `${order?.shipping_address?.address1 || ''} ${order?.shipping_address?.address2 || ''}`.trim(),
          phone: order?.shipping_address?.phone || order?.customer?.phone || '',
          email: order?.email || order?.customer?.email || ''
        }
      },
      products,
      invoice_no: invoiceNo,
      source_platform: 'shopify',
      source_order_number: order?.order_number || order?.id
    },
    items,
    missing,
    invoiceNo,
    totalQuantity
  };
}

async function syncShopifyOrderToProkip(order, connection, userId) {
  if (!order) return { success: false, error: 'Missing Shopify order data' };
  if (!shouldProcessShopifyOrder(order)) {
    return { success: true, action: 'skipped', reason: 'status_not_eligible' };
  }

  const skuMap = await getSkuMapForUser(userId, connection?.id || null);
  const { payload, items, missing, invoiceNo, totalQuantity } = mapShopifyOrderToProkipOrder(order, skuMap, connection);

  if (!items || !items.length) {
    return { success: false, error: 'No mappable SKUs found for this order', missing };
  }

  const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : null;
  const locationId = config?.locationId ? parseInt(config.locationId, 10) : null;

  if (!locationId) {
    return { success: false, error: 'Missing Prokip business location for this user' };
  }

  let prokipOrder = null;
  try {
    prokipOrder = await prokipEcomClient.createOrder(payload, userId);
  } catch (err) {
    prokipOrder = { success: false, error: err.message };
  }

  let deduction = null;
  try {
    deduction = await prokipLocalAuthService.deductStockForVariations(locationId, items);
  } catch (err) {
    deduction = { success: false, error: err.message };
  }

  return {
    success: true,
    prokip_order: prokipOrder,
    response: prokipOrder,
    stock: deduction,
    missing,
    mappedCount: items.length,
    invoiceNo,
    totalQuantity
  };
}

async function invalidateSkuMapForUser(userId) {
  const useLocalProkip = process.env.PROKIP_LOCAL_AUTH === 'true';

  if (useLocalProkip) {
    const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : null;
    const locationId = config?.locationId || 'default';
    skuMapCache.delete(`local:${locationId}`);
    return;
  }

  if (!userId) return;
  for (const key of skuMapCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      skuMapCache.delete(key);
    }
  }
}

module.exports = {
  syncWooOrderToProkip,
  syncShopifyOrderToProkip,
  mapShopifyOrderToProkipOrder,
  getSkuMapForUser,
  mapWooOrderToProkipOrder,
  invalidateSkuMapForUser,
  buildInvoiceNumber
};
