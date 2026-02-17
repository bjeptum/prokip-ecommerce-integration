const express = require('express');
const prisma = require('../lib/prisma');
const { decryptCredentials, decryptAppPassword, createOrUpdateProductInStore, updateInventoryInStore } = require('../services/storeService');
const { testWooConnection, getWooOrders, getWooProducts } = require('../services/wooService');
const { testShopifyConnection, getShopifyOrders, getShopifyProducts } = require('../services/shopifyService');
const prokipEcomClient = require('../services/prokipEcomClient');
const { handleWooCommerceInventorySync } = require('../services/wooInventorySyncService');
const prokipLocalAuthService = require('../services/prokipLocalAuthService');
const { invalidateSkuMapForUser, syncShopifyOrderToProkip, buildInvoiceNumber } = require('../services/prokipEcomOrderSyncService');

const router = express.Router();
const IS_LOCAL_PROKIP = process.env.PROKIP_LOCAL_AUTH === 'true';

function normalizeKey(value) {
  return (value || '').toString().trim().toLowerCase();
}

function chunkArray(array, chunkSize) {
  if (!Array.isArray(array) || chunkSize <= 0) return [];
  const out = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    out.push(array.slice(i, i + chunkSize));
  }
  return out;
}

async function resolveProkipStoreId(localStoreId, userId) {
  if (IS_LOCAL_PROKIP) return parseInt(localStoreId, 10);

  const connection = await prisma.connection.findFirst({
    where: { id: parseInt(localStoreId), userId }
  });

  if (!connection) return null;

  const normalizeUrl = (raw) => {
    try {
      const withScheme = raw.startsWith('http') ? raw : `https://${raw}`;
      const url = new URL(withScheme);
      const pathname = url.pathname.replace(/\/$/, '');
      return `${url.origin}${pathname}`;
    } catch {
      return (raw || '').replace(/\/$/, '').toLowerCase();
    }
  };

  const normalizeOrigin = (raw) => {
    try {
      const withScheme = raw.startsWith('http') ? raw : `https://${raw}`;
      const url = new URL(withScheme);
      return url.origin.toLowerCase();
    } catch {
      return (raw || '').replace(/\/$/, '').toLowerCase();
    }
  };

  try {
    const storesResponse = await prokipEcomClient.getStores(userId);
    const stores = storesResponse.stores || storesResponse.data || storesResponse || [];
    const normalizedLocalUrl = normalizeUrl(connection.storeUrl);
    const normalizedLocalOrigin = normalizeOrigin(connection.storeUrl);
    const matched = stores.find(s => {
      const storeUrl = s.store_url || s.storeUrl || '';
      const normalizedStoreUrl = normalizeUrl(storeUrl);
      const normalizedStoreOrigin = normalizeOrigin(storeUrl);
      return normalizedStoreUrl === normalizedLocalUrl || normalizedStoreOrigin === normalizedLocalOrigin;
    });
    return matched?.id || matched?.store_id || null;
  } catch (error) {
    return null;
  }
}

async function ensureProkipStoreId(localStoreId, userId) {
  if (IS_LOCAL_PROKIP) return parseInt(localStoreId, 10);

  const existing = await resolveProkipStoreId(localStoreId, userId);
  if (existing) return existing;

  const connection = await prisma.connection.findFirst({
    where: { id: parseInt(localStoreId), userId }
  });
  if (!connection) return null;

  try {
    if (connection.platform === 'woocommerce') {
      const { consumerKey, consumerSecret } = decryptCredentials(connection);
      await prokipEcomClient.connectStore({
        platform: 'woocommerce',
        store_url: connection.storeUrl,
        api_key: consumerKey,
        api_secret: consumerSecret
      }, userId);
    } else if (connection.platform === 'shopify') {
      await prokipEcomClient.connectStore({
        platform: 'shopify',
        store_url: connection.storeUrl,
        access_token: connection.accessToken
      }, userId);
    }
  } catch (error) {
    return null;
  }

  return await resolveProkipStoreId(localStoreId, userId);
}

async function resolveConnection(storeId, userId) {
  const id = parseInt(storeId, 10);
  let connection = await prisma.connection.findFirst({
    where: { id, userId }
  });

  if (!connection && process.env.PROKIP_LOCAL_AUTH === 'true') {
    connection = await prisma.connection.findFirst({ where: { id } });
  }

  return connection;
}

// Custom authentication middleware for sync routes
router.use(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  // Try to verify as JWT first
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.user = decoded;
    return next();
  } catch (jwtError) {
    // If JWT fails, try Prokip token
    try {
      const prokipConfig = await prisma.prokipConfig.findFirst({ where: { token } });
      
      if (prokipConfig) {
        req.userId = prokipConfig.userId;
        req.user = { id: prokipConfig.userId };
        return next();
      } else {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
    } catch (dbError) {
      return res.status(403).json({ error: 'Invalid token' });
    }
  }
});

/**
 * PROKIP E-COMMERCE API ENDPOINTS
 * Proxy to Prokip-2 /api/ecom/* endpoints
 */

/**
 * Connect Store to Prokip
 * POST /api/ecom/connect-store
 */
router.post('/connect-store', async (req, res) => {
  try {
    const { platform, store_url, api_key, api_secret, access_token } = req.body;
    const userId = req.userId;

    if (!platform || !store_url) {
      return res.status(400).json({ 
        success: false, 
        message: 'Platform and store URL are required' 
      });
    }

    const normalizedStoreUrl = store_url.startsWith('http') ? store_url : `https://${store_url}`;

    if (platform === 'woocommerce' && (!api_key || !api_secret)) {
      return res.status(400).json({ 
        success: false, 
        message: 'API key and secret are required for WooCommerce' 
      });
    }

    if (platform === 'shopify' && !access_token) {
      return res.status(400).json({ 
        success: false, 
        message: 'Access token is required for Shopify' 
      });
    }

    // Validate connection
    let testResult;
    if (platform === 'woocommerce') {
      testResult = await testWooConnection(normalizedStoreUrl, api_key, api_secret);
    } else if (platform === 'shopify') {
      testResult = await testShopifyConnection(normalizedStoreUrl, access_token);
    }

    if (!testResult?.success) {
      return res.status(400).json({ 
        success: false, 
        message: testResult?.message || 'Store connection test failed' 
      });
    }

    // Store connection locally (for webhooks + internal tracking)
    const connection = await prisma.connection.create({
      data: {
        userId,
        platform,
        storeUrl: normalizedStoreUrl,
        accessToken: access_token || null,
        consumerKey: api_key || null,
        consumerSecret: api_secret || null,
        status: 'connected',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Register WooCommerce webhooks for automatic order sync in local mode
    if (platform === 'woocommerce' && process.env.PROKIP_LOCAL_AUTH === 'true') {
      try {
        const { registerWooWebhooks } = require('../services/wooService');
        await registerWooWebhooks(normalizedStoreUrl, api_key, api_secret);
      } catch (err) {
        console.warn('⚠️ Failed to register WooCommerce webhooks:', err.message);
      }
    }

    res.json({
      success: true,
      store_id: connection.id,
      local_store_id: connection.id,
      message: 'Store connected successfully'
    });
  } catch (error) {
    console.error('Connect store error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to connect store',
      error: error.message 
    });
  }
});

/**
 * Sync Products to Prokip
 * POST /api/ecom/sync-products
 */
router.post('/sync-products', async (req, res) => {
  try {
    const { store_id, limit = 100, page = 1 } = req.body;
    // When false (default), skip products that already exist in Prokip to avoid duplicates/inflated stock.
    const overwriteStock = req.body?.overwrite_stock === true || req.body?.overwrite_stock === 'true';
    const userId = req.userId;

    if (!store_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Store ID is required' 
      });
    }

    const connection = await resolveConnection(store_id, userId);

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found for this user'
      });
    }

    if (process.env.PROKIP_LOCAL_AUTH === 'true') {
      if (connection.platform !== 'woocommerce') {
        return res.status(400).json({
          success: false,
          message: 'Product sync is only supported for WooCommerce connections in local mode'
        });
      }

      const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId } });
      const locationId = prokipConfig?.locationId ? parseInt(prokipConfig.locationId, 10) : null;
      if (!locationId) {
        return res.status(400).json({
          success: false,
          message: 'Please select a Prokip business location before syncing products'
        });
      }

      const { consumerKey, consumerSecret } = decryptCredentials(connection);
      const appPassword = decryptAppPassword(connection);
      const wooProducts = await getWooProducts(
        connection.storeUrl,
        consumerKey,
        consumerSecret,
        connection.oauthToken,
        connection.oauthSecret,
        connection.wooUsername,
        appPassword,
        { per_page: limit, page }
      );

      let wooProductsToImport = wooProducts || [];
      if (!overwriteStock) {
        // Skip products that already exist in Prokip to avoid duplicate/stock inflation
        const existingProkipProducts = await prokipLocalAuthService.getProducts(locationId);
        const existingSkuSet = new Set(
          (existingProkipProducts || [])
            .map(p => (p.sku || '').trim().toLowerCase())
            .filter(Boolean)
        );

        wooProductsToImport = wooProductsToImport.filter(p => {
          const skuKey = (p?.sku || p?.id?.toString() || '').trim().toLowerCase();
          return skuKey && !existingSkuSet.has(skuKey);
        });
      }

      let synced = 0;
      const now = new Date();

      if (!wooProductsToImport.length) {
        return res.json({
          success: true,
          store_id: connection.id,
          products_synced: 0,
          products_skipped_existing: (wooProducts?.length || 0),
          prokip_import: { products_created: 0, products_updated: 0 },
          message: 'No new WooCommerce products to import'
        });
      }

      // Persist products into the Prokip MySQL DB so they appear on the Prokip dashboard
      // and can be used for local stock deduction.
      const prokipImport = await prokipLocalAuthService.upsertWooProductsToProkip(locationId, wooProductsToImport, { overwriteStock });
      await invalidateSkuMapForUser(userId);

      for (const product of wooProductsToImport || []) {
        const sku = (product?.sku || product?.id?.toString() || '').trim();
        if (!sku) continue;

        const quantity = parseInt(product?.stock_quantity ?? 0, 10) || 0;
        const priceRaw = product?.regular_price ?? product?.price ?? 0;
        const price = Number.parseFloat(priceRaw || 0) || 0;

        await prisma.inventoryLog.upsert({
          where: { connectionId_sku: { connectionId: connection.id, sku } },
          update: {
            productId: product?.id?.toString() || sku,
            productName: product?.name || product?.slug || 'Product',
            quantity,
            price,
            lastSynced: now
          },
          create: {
            connectionId: connection.id,
            productId: product?.id?.toString() || sku,
            productName: product?.name || product?.slug || 'Product',
            sku,
            quantity,
            price,
            lastSynced: now
          }
        });
        synced += 1;
      }

      await prisma.connection.update({
        where: { id: connection.id },
        data: { lastSync: now }
      });

      return res.json({
        success: true,
        store_id: connection.id,
        products_synced: synced,
        products_skipped_existing: (wooProducts?.length || 0) - synced,
        prokip_import: prokipImport,
        message: `Products synced successfully (${synced})`
      });
    }

    const resolvedStoreId = await ensureProkipStoreId(store_id, userId);
    if (!resolvedStoreId) {
      return res.status(404).json({
        success: false,
        message: 'Store not connected in Prokip. Please reconnect the store.',
        hint: 'Ensure PROKIP_BASE_URL and PROKIP_ECOM_TOKEN are set to your Prokip-2 server.'
      });
    }

    if (connection.platform === 'woocommerce') {
      const { consumerKey, consumerSecret } = decryptCredentials(connection);
      const appPassword = decryptAppPassword(connection);
      const wooProducts = await getWooProducts(
        connection.storeUrl,
        consumerKey,
        consumerSecret,
        connection.oauthToken,
        connection.oauthSecret,
        connection.wooUsername,
        appPassword
      );

      const mappedProducts = (wooProducts || []).map((product) => ({
        sku: product.sku || product.id?.toString(),
        name: product.name || product.slug || 'Product',
        stock_qty: parseInt(product.stock_quantity || 0)
      }));

      const response = await prokipEcomClient.syncProducts({
        store_id: resolvedStoreId,
        limit,
        page,
        products: mappedProducts
      }, userId);

      return res.json(response);
    }

    const response = await prokipEcomClient.syncProducts({
      store_id: resolvedStoreId,
      limit,
      page
    }, userId);

    res.json(response);
  } catch (error) {
    console.error('Sync products error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to sync products',
      error: error.response?.data?.message || error.message,
      details: error.response?.data || null
    });
  }
});

/**
 * Push Products from Prokip to Store
 * POST /api/ecom/push-products
 */
async function handlePushProducts(req, res) {
  try {
    const { store_id, limit = 100 } = req.body;
    const userId = req.userId;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required'
      });
    }

    if (process.env.PROKIP_LOCAL_AUTH !== 'true') {
      return res.status(400).json({
        success: false,
        message: 'Push products is only supported in local Prokip mode for now'
      });
    }

    const connection = await resolveConnection(store_id, userId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found for this user'
      });
    }

    if (connection.platform !== 'woocommerce') {
      return res.status(400).json({
        success: false,
        message: 'Push products is only supported for WooCommerce connections'
      });
    }

    const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId } });
    const locationId = prokipConfig?.locationId ? parseInt(prokipConfig.locationId, 10) : null;
    if (!locationId) {
      return res.status(400).json({
        success: false,
        message: 'Please select a Prokip business location before pushing products'
      });
    }

    const prokipProducts = await prokipLocalAuthService.getProducts(locationId);
    const productsToPush = (prokipProducts || []).slice(0, Math.max(0, parseInt(limit, 10) || 0));

    // Fetch current Woo products to avoid pushing duplicates
    let existingWooSkus = new Set();
    try {
      const { consumerKey, consumerSecret } = decryptCredentials(connection);
      const appPassword = decryptAppPassword(connection);
      const wooProducts = await getWooProducts(
        connection.storeUrl,
        consumerKey,
        consumerSecret,
        connection.oauthToken,
        connection.oauthSecret,
        connection.wooUsername,
        appPassword,
        { per_page: 100, status: 'any' }
      );
      existingWooSkus = new Set(
        (wooProducts || [])
          .map(p => (p?.sku || p?.id || '').toString().trim().toLowerCase())
          .filter(Boolean)
      );
    } catch (err) {
      console.log('Skipping duplicate pre-check; could not fetch Woo products:', err.message);
    }

    let pushed = 0;
    let failed = 0;
    let skippedExisting = 0;
    const errors = [];

    const concurrency = 4;
    const batches = chunkArray(productsToPush, concurrency);

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(async (prokipProduct) => {
          const sku = (prokipProduct?.sku || prokipProduct?.id?.toString() || '').trim();
          if (!sku) return { success: false, sku: null, message: 'Missing SKU' };

          const price = Number.parseFloat(prokipProduct?.sell_price_inc_tax || 0) || 0;
          const qtyRaw = prokipProduct?.qty_available;
          const hasQty = qtyRaw !== null && qtyRaw !== undefined && Number.isFinite(Number.parseFloat(qtyRaw));
          const stock_quantity = hasQty
            ? Math.max(0, Math.floor(Number.parseFloat(qtyRaw)))
            : undefined; // leave Woo stock untouched when we don't have location stock

          const skuKey = sku.toLowerCase();
          if (existingWooSkus.has(skuKey)) {
            skippedExisting += 1;
            return { success: true, sku, message: 'Already in WooCommerce' };
          }

          await createOrUpdateProductInStore(connection, {
            name: prokipProduct?.name || `Product ${sku}`,
            title: prokipProduct?.name || `Product ${sku}`,
            sku,
            price,
            stock_quantity
          });

          return { success: true, sku };
        })
      );

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value?.success) {
            pushed += 1;
          } else {
            failed += 1;
            errors.push({
              sku: result.value?.sku || null,
              message: result.value?.message || 'Failed to push product'
            });
          }
          return;
        }

        failed += 1;
        errors.push({
          sku: null,
          message: result.reason?.message || 'Failed to push product'
        });
      });
    }

    return res.json({
      success: true,
      store_id: connection.id,
      locationId,
      products_found: prokipProducts?.length || 0,
      products_attempted: productsToPush.length,
      products_pushed: pushed,
      products_failed: failed,
      products_skipped_existing: skippedExisting,
      errors: errors.slice(0, 20),
      message: `Push completed: ${pushed} pushed, ${skippedExisting} skipped (already in Woo), ${failed} failed`
    });
  } catch (error) {
    console.error('Push products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to push products',
      error: error.response?.data?.message || error.message,
      details: error.response?.data || null
    });
  }
}

router.post('/push-products', handlePushProducts);
// Alias used by Prokip-2 UI ("Sync Inventory")
router.post('/sync-inventory', handlePushProducts);

/**
 * Pull inventory from store and set Prokip stock to match (useful for restocks/additions)
 * POST /api/ecom/sync-inventory-from-store
 */
router.post('/sync-inventory-from-store', async (req, res) => {
  try {
    const { store_id, limit = 100, page = 1 } = req.body;
    const userId = req.userId;

    if (!store_id) {
      return res.status(400).json({ success: false, message: 'Store ID is required' });
    }

    const connection = await resolveConnection(store_id, userId);
    if (!connection) {
      return res.status(404).json({ success: false, message: 'Connection not found for this user' });
    }

    // Remote mode: delegate to Prokip-2 API which already handles overwriting stock.
    if (process.env.PROKIP_LOCAL_AUTH !== 'true') {
      const response = await prokipEcomClient.syncProducts(
        { store_id, overwrite_stock: true, limit, page },
        userId
      );
      return res.json({ success: true, mode: 'remote', response });
    }

    const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId } });
    const locationId = prokipConfig?.locationId ? parseInt(prokipConfig.locationId, 10) : null;
    if (!locationId) {
      return res.status(400).json({ success: false, message: 'Select a Prokip business location first' });
    }

    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];
    const now = new Date();

    if (connection.platform === 'woocommerce') {
      const { consumerKey, consumerSecret } = decryptCredentials(connection);
      const appPassword = decryptAppPassword(connection);
      const wooProducts = await getWooProducts(
        connection.storeUrl,
        consumerKey,
        consumerSecret,
        connection.oauthToken,
        connection.oauthSecret,
        connection.wooUsername,
        appPassword,
        { per_page: limit, page, status: 'any' }
      );

      for (const product of wooProducts || []) {
        const sku = (product?.sku || '').trim();
        if (!sku) { skipped += 1; continue; }
        const qty = product?.stock_quantity;
        if (qty === null || qty === undefined || Number.isNaN(Number.parseFloat(qty))) {
          skipped += 1;
          continue;
        }
        try {
          await prokipLocalAuthService.setStockForSku(locationId, sku, qty);
          await prisma.inventoryLog.upsert({
            where: { connectionId_sku: { connectionId: connection.id, sku } },
            update: { quantity: parseInt(qty, 10) || 0, lastSynced: now },
            create: {
              connectionId: connection.id,
              productId: product?.id?.toString() || sku,
              productName: product?.name || 'Product',
              sku,
              quantity: parseInt(qty, 10) || 0,
              price: parseFloat(product?.regular_price || 0) || 0,
              lastSynced: now
            }
          });
          updated += 1;
        } catch (err) {
          failed += 1;
          if (errors.length < 10) errors.push({ sku, error: err.message });
        }
      }
    } else if (connection.platform === 'shopify') {
      const shopifyProducts = await getShopifyProducts(connection.storeUrl, connection.accessToken);
      for (const product of shopifyProducts || []) {
        for (const variant of product?.variants || []) {
          const sku = (variant?.sku || '').trim();
          if (!sku) { skipped += 1; continue; }
          const qty = variant?.inventory_quantity;
          if (qty === null || qty === undefined || Number.isNaN(Number.parseFloat(qty))) {
            skipped += 1;
            continue;
          }
          try {
            await prokipLocalAuthService.setStockForSku(locationId, sku, qty);
            await prisma.inventoryLog.upsert({
              where: { connectionId_sku: { connectionId: connection.id, sku } },
              update: { quantity: parseInt(qty, 10) || 0, lastSynced: now },
              create: {
                connectionId: connection.id,
                productId: variant?.id?.toString() || sku,
                productName: product?.title || 'Product',
                sku,
                quantity: parseInt(qty, 10) || 0,
                price: parseFloat(variant?.price || 0) || 0,
                lastSynced: now
              }
            });
            updated += 1;
          } catch (err) {
            failed += 1;
            if (errors.length < 10) errors.push({ sku, error: err.message });
          }
        }
      }
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported platform for inventory pull' });
    }

    res.json({
      success: failed === 0,
      platform: connection.platform,
      products_updated: updated,
      products_failed: failed,
      products_skipped: skipped,
      errors
    });
  } catch (error) {
    console.error('Sync inventory from store error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync inventory from store',
      error: error.message
    });
  }
});

/**
 * Sync Orders to Prokip (with stock deduction)
 * POST /api/ecom/sync-orders
 */
router.post('/sync-orders', async (req, res) => {
  try {
    const { store_id, status = 'processing,completed', limit = 100 } = req.body;
    const direction = req.body?.direction || (process.env.PROKIP_LOCAL_AUTH === 'true' ? 'both' : 'woo_to_prokip');
    const userId = req.userId;

    if (!store_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Store ID is required' 
      });
    }

    const connection = await resolveConnection(store_id, userId);

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found for this user'
      });
    }

    if (connection.platform === 'shopify') {
      const orders = await getShopifyOrders(connection.storeUrl, connection.accessToken, limit);

      if (!orders || orders.length === 0) {
        return res.json({
          success: true,
          message: 'No Shopify orders found',
          orders_processed: 0,
          stock_deductions: 0
        });
      }

      const paidStatuses = ['paid', 'partially_paid', 'partially_refunded', 'authorized'];
      const paidOrders = orders.filter(o => paidStatuses.includes((o.financial_status || '').toLowerCase()));
      const limitedOrders = paidOrders.slice(0, limit);

      let processed = 0;
      let skipped = orders.length - paidOrders.length;
      let failed = 0;
      const failures = [];

      for (const order of limitedOrders) {
        try {
          const result = await syncShopifyOrderToProkip(order, connection, userId);
          if (result?.action === 'skipped') {
            skipped += 1;
            continue;
          }
          if (result?.success) {
            processed += 1;
            const invoiceNo = result.invoiceNo || buildInvoiceNumber('shopify', order.order_number, order.id);
            const orderId = order.id?.toString();
            try {
              await prisma.salesLog.upsert({
                where: {
                  connectionId_orderId: {
                    connectionId: connection.id,
                    orderId
                  }
                },
                update: {
                  invoiceNo,
                  orderNumber: order.order_number?.toString(),
                  platform: 'shopify',
                  customerName: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim() || order.email || 'Unknown',
                  customerEmail: order.email || order.customer?.email || null,
                  totalAmount: parseFloat(order.total_price || order.current_total_price || 0),
                  status: order.financial_status || order.fulfillment_status || 'paid',
                  orderDate: new Date(order.created_at || Date.now()),
                  stockDeducted: true,
                  stockDeductionDate: new Date()
                },
                create: {
                  connectionId: connection.id,
                  orderId,
                  orderNumber: order.order_number?.toString(),
                  invoiceNo,
                  platform: 'shopify',
                  customerName: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim() || order.email || 'Unknown',
                  customerEmail: order.email || order.customer?.email || null,
                  totalAmount: parseFloat(order.total_price || order.current_total_price || 0),
                  status: order.financial_status || order.fulfillment_status || 'paid',
                  orderDate: new Date(order.created_at || Date.now()),
                  stockDeducted: true,
                  stockDeductionDate: new Date()
                }
              });
            } catch (logErr) {
              console.warn('⚠️ Failed to log Shopify order in SalesLog:', logErr.message);
            }
          } else {
            failed += 1;
            if (failures.length < 10) {
              failures.push({
                orderId: order.id?.toString() || null,
                reason: result?.reason || null,
                error: result?.error || null,
                missing: result?.missing || null
              });
            }
          }
        } catch (err) {
          failed += 1;
          if (failures.length < 10) {
            failures.push({
              orderId: order.id?.toString() || null,
              error: err.message
            });
          }
        }
      }

      return res.json({
        success: failed === 0,
        orders_found: paidOrders.length,
        orders_processed: processed,
        orders_skipped: skipped,
        orders_failed: failed,
        failures,
        message: `Shopify orders sync complete: ${processed} processed, ${skipped} skipped, ${failed} failed`
      });
    }

    if (connection.platform !== 'woocommerce') {
      return res.status(400).json({
        success: false,
        message: 'Order sync is only supported for WooCommerce or Shopify connections'
      });
    }

    // Local mode: allow bidirectional without changing code by default.
    // direction options: 'woo_to_prokip', 'prokip_to_woo', 'both' (default in local)
    const runProkipToWoo = process.env.PROKIP_LOCAL_AUTH === 'true' &&
      (direction === 'prokip_to_woo' || direction === 'both');
    const runWooToProkip = direction === 'woo_to_prokip' || direction === 'both';
    let prokipToWooResult = null;

    if (process.env.PROKIP_LOCAL_AUTH === 'true' && runProkipToWoo) {
      try {
        const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId } });
        const locationId = prokipConfig?.locationId ? parseInt(prokipConfig.locationId, 10) : null;

        if (!locationId) {
          return res.status(400).json({
            success: false,
            message: 'Please select a Prokip business location before syncing orders'
          });
        }

        const { consumerKey, consumerSecret } = decryptCredentials(connection);
        const appPassword = decryptAppPassword(connection);
        const hasKeyPair = consumerKey && consumerSecret;
        const hasAppPassword = connection.wooUsername && appPassword;

        if (!hasKeyPair && !hasAppPassword) {
          return res.status(400).json({
            success: false,
            message: 'WooCommerce credentials missing. Please reconnect your store.',
            hint: 'Provide Consumer Key/Secret or an Application Password with username.'
          });
        }

        const prokipProducts = await prokipLocalAuthService.getProducts(locationId);

        let updated = 0;
        let skipped = 0;
        let failed = 0;
        const errors = [];

        // Decrypt Woo creds once
        for (const product of prokipProducts) {
          const sku = (product?.sku || '').trim();
          const qtyRaw = product?.qty_available;
          if (!sku || qtyRaw === null || qtyRaw === undefined) {
            skipped += 1;
            continue;
          }
          const qty = Number.parseFloat(qtyRaw);
          if (!Number.isFinite(qty) || qty < 0) {
            skipped += 1;
            continue;
          }

          const skuKey = sku.toLowerCase();

          try {
            const wooProducts = await getWooProducts(
              connection.storeUrl,
              hasKeyPair ? consumerKey : null,
              hasKeyPair ? consumerSecret : null,
              connection.oauthToken,
              connection.oauthSecret,
              connection.wooUsername,
              hasAppPassword ? appPassword : null,
              { sku: skuKey, per_page: 1, status: 'any' }
            );

            const wooProduct = Array.isArray(wooProducts) ? wooProducts[0] : null;
            if (!wooProduct) {
              errors.push({ sku, error: 'SKU not found in WooCommerce' });
              failed += 1;
              continue;
            }

            await updateInventoryInStore(connection, wooProduct.sku || sku, Math.max(0, Math.floor(qty)));
            updated += 1;
          } catch (err) {
            failed += 1;
            if (errors.length < 10) {
              errors.push({ sku, error: err.message });
            }
          }
        }

        prokipToWooResult = {
          success: failed === 0,
          message: `Prokip stock mirrored to Woo: ${updated} updated, ${skipped} skipped, ${failed} failed`,
          products_updated: updated,
          products_failed: failed,
          products_skipped: skipped,
          orders_processed: updated,
          orders_failed: failed,
          errors
        };

        // If only Prokip -> Woo was requested, respond now.
        if (!runWooToProkip) {
          return res.json(prokipToWooResult);
        }
      } catch (err) {
        console.error('Local Prokip sync-orders error:', err);
        return res.status(200).json({
          success: false,
          message: 'Failed to sync Prokip sales to WooCommerce',
          error: err.message
        });
      }
    }

    const { consumerKey, consumerSecret } = decryptCredentials(connection);
    const appPassword = decryptAppPassword(connection);
    const orders = await getWooOrders(
      connection.storeUrl,
      consumerKey,
      consumerSecret,
      connection.oauthToken,
      connection.oauthSecret,
      connection.wooUsername,
      appPassword
    );

    if (!orders || orders.length === 0) {
      return res.json({
        success: true,
        message: 'No WooCommerce orders found for the selected statuses.',
        orders_processed: 0,
        stock_deductions: 0
      });
    }

    const statusList = (status || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    const filteredOrders = statusList.length
      ? orders.filter(o => statusList.includes((o.status || '').toLowerCase()))
      : orders;

    const limitedOrders = filteredOrders.slice(0, limit);

    let processed = 0;
    let skipped = 0;
    let failed = 0;
    const failures = [];

    let prokipAutoImport = null;
    if (process.env.PROKIP_LOCAL_AUTH === 'true') {
      const prokipConfig = await prisma.prokipConfig.findFirst({ where: { userId } });
      const locationId = prokipConfig?.locationId ? parseInt(prokipConfig.locationId, 10) : null;

      if (!locationId) {
        return res.status(400).json({
          success: false,
          message: 'Please select a Prokip business location before syncing orders'
        });
      }

      // If orders reference products not in Prokip yet, import them first so mapping succeeds.
      const skuMap = await prokipLocalAuthService.getSkuVariationMap(locationId);
      const missingProductIds = new Set();

      for (const order of limitedOrders) {
        for (const item of order?.line_items || []) {
          const pid = item?.product_id;
          if (!pid) continue;
          const key = normalizeKey(pid);
          if (key && !skuMap.has(key)) {
            missingProductIds.add(pid.toString());
          }
        }
      }

      const missingList = Array.from(missingProductIds);
      if (missingList.length > 0) {
        prokipAutoImport = {
          missing_products_detected: missingList.length,
          imported_products: 0,
          batches: 0,
          prokip_imports: []
        };

        for (const batch of chunkArray(missingList, 40)) {
          const wooProducts = await getWooProducts(
            connection.storeUrl,
            consumerKey,
            consumerSecret,
            connection.oauthToken,
            connection.oauthSecret,
            connection.wooUsername,
            appPassword,
            { include: batch.join(','), per_page: batch.length, status: 'any' }
          );

          const importStats = await prokipLocalAuthService.upsertWooProductsToProkip(locationId, wooProducts);
          prokipAutoImport.imported_products += Array.isArray(wooProducts) ? wooProducts.length : 0;
          prokipAutoImport.batches += 1;
          prokipAutoImport.prokip_imports.push(importStats);
        }

        await invalidateSkuMapForUser(userId);
      }
    }

    const concurrency = 5;
    for (const batch of chunkArray(limitedOrders, concurrency)) {
      const results = await Promise.all(
        batch.map(order => handleWooCommerceInventorySync(
          order,
          {
            'x-wc-webhook-topic': 'manual-sync',
            'x-wc-webhook-source': connection.storeUrl
          },
          userId
        ))
      );

      results.forEach((result, idx) => {
        const order = batch[idx];
        if (result?.action === 'skipped') {
          skipped += 1;
        } else if (result?.success) {
          processed += 1;
        } else {
          failed += 1;
          if (failures.length < 10) {
            failures.push({
              orderId: order?.id?.toString() || null,
              reason: result?.reason || null,
              error: result?.error || null,
              missing: result?.missing || null
            });
          }
        }
      });
    }

    const wooToProkipResult = {
      success: failed === 0,
      orders_found: filteredOrders.length,
      orders_processed: processed,
      orders_skipped: skipped,
      orders_failed: failed,
      failures,
      prokip_auto_import: prokipAutoImport,
      message: `Orders sync complete: ${processed} processed, ${skipped} skipped, ${failed} failed`
    };

    if (process.env.PROKIP_LOCAL_AUTH === 'true' && prokipToWooResult) {
      return res.json({
        success: wooToProkipResult.success && prokipToWooResult.success,
        woo_to_prokip: wooToProkipResult,
        prokip_to_woo: prokipToWooResult
      });
    }

    res.json(wooToProkipResult);
  } catch (error) {
    console.error('Sync orders error:', error);
    res.status(200).json({ 
      success: false, 
      message: 'Failed to sync orders',
      error: error.response?.data?.message || error.message,
      details: error.response?.data || null
    });
  }
});

/**
 * Get Connected Stores
 * GET /api/ecom/stores
 */
router.get('/stores', async (req, res) => {
  try {
    const userId = req.userId;

    if (process.env.PROKIP_LOCAL_AUTH === 'true') {
      const connections = await prisma.connection.findMany({
        where: {
          userId,
          platform: { in: ['woocommerce', 'shopify'] }
        },
        select: {
          id: true,
          platform: true,
          storeUrl: true,
          storeName: true,
          lastSync: true,
          syncEnabled: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return res.json({ success: true, stores: connections });
    }

    const response = await prokipEcomClient.getStores(userId);
    res.json(response);
  } catch (error) {
    console.error('Get stores error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get stores',
      error: error.response?.data?.message || error.message,
      details: error.response?.data || null
    });
  }
});

/**
 * Test Store Connection
 * POST /api/ecom/test-connection
 */
router.post('/test-connection', async (req, res) => {
  try {
    const { store_id } = req.body;
    const userId = req.userId;

    if (!store_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Store ID is required' 
      });
    }

    if (process.env.PROKIP_LOCAL_AUTH === 'true') {
      const connection = await resolveConnection(store_id, userId);
      if (!connection) {
        return res.status(404).json({
          success: false,
          message: 'Connection not found for this user'
        });
      }

      if (connection.platform === 'woocommerce') {
        const { consumerKey, consumerSecret } = decryptCredentials(connection);
        const appPassword = decryptAppPassword(connection);
        const test = await testWooConnection(
          connection.storeUrl,
          consumerKey,
          consumerSecret,
          connection.oauthToken,
          connection.oauthSecret,
          connection.wooUsername,
          appPassword
        );

        return res.json({
          success: test.success !== false,
          message: test.message || (test.success !== false ? 'Connection is working' : 'Connection test failed'),
          details: test.details || null,
          storeUrl: connection.storeUrl
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Test connection is only implemented for WooCommerce in local mode'
      });
    }

    const resolvedStoreId = await ensureProkipStoreId(store_id, userId);
    const response = await prokipEcomClient.testConnection({ store_id: resolvedStoreId || store_id }, userId);
    res.json(response);
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to test connection',
      error: error.response?.data?.message || error.message,
      details: error.response?.data || null
    });
  }
});

/**
 * Disconnect Store
 * DELETE /api/ecom/disconnect-store/:id
 */
router.delete('/disconnect-store/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (process.env.PROKIP_LOCAL_AUTH === 'true') {
      const connection = await resolveConnection(id, userId);
      if (!connection) {
        return res.status(404).json({
          success: false,
          message: 'Connection not found for this user'
        });
      }

      await prisma.connection.delete({ where: { id: connection.id } });

      return res.json({
        success: true,
        message: 'Store disconnected successfully'
      });
    }

    const resolvedStoreId = await ensureProkipStoreId(id, userId);
    const response = await prokipEcomClient.disconnectStore(resolvedStoreId || id, userId);
    res.json(response);
  } catch (error) {
    console.error('Disconnect store error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to disconnect store',
      error: error.response?.data?.message || error.message,
      details: error.response?.data || null
    });
  }
});

/**
 * Get Sync Status
 * GET /api/ecom/sync-status/:store_id
 */
router.get('/sync-status/:store_id', async (req, res) => {
  try {
    const { store_id } = req.params;
    const userId = req.userId;
    const connection = await resolveConnection(store_id, userId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found for this user'
      });
    }

    if (process.env.PROKIP_LOCAL_AUTH === 'true') {
      let totalProducts = 0;
      let totalOrders = 0;

      try {
        totalProducts = await prisma.inventoryLog.count({ where: { connectionId: connection.id } });
      } catch {
        totalProducts = 0;
      }

      try {
        totalOrders = await prisma.salesLog.count({ where: { connectionId: connection.id } });
      } catch {
        totalOrders = 0;
      }

      return res.json({
        success: true,
        message: 'Sync status loaded',
        total_products: totalProducts,
        total_orders: totalOrders,
        last_sync: connection.lastSync || null
      });
    }

    const resolvedStoreId = await ensureProkipStoreId(connection.id, userId);
    if (!resolvedStoreId) {
      return res.json({
        success: false,
        message: 'Store not connected in Prokip yet.',
        total_products: 0,
        total_orders: 0,
        last_sync: connection.lastSync || null
      });
    }

    const response = await prokipEcomClient.getSyncStatus(resolvedStoreId, userId);
    return res.json(response);
  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get sync status',
      error: error.response?.data?.message || error.message,
      details: error.response?.data || null
    });
  }
});

// Status endpoint doesn't require auth (public dashboard data)
router.get('/status', async (req, res) => {
  const connections = await prisma.connection.findMany();

  let prokipStats = { products: 0, sales: 0, purchases: 0 };

  try {
    const prokipProducts = await prisma.inventoryLog.groupBy({
      by: ['sku'],
      _count: { sku: true }
    });
    prokipStats.products = prokipProducts.length;

    const salesCount = await prisma.salesLog.count({
      where: { 
        status: {
          in: ['completed', 'paid', 'processing']
        }
      }
    });

    prokipStats.sales = salesCount;
    prokipStats.purchases = 0;
  } catch (error) {
    console.error('Error fetching Prokip stats:', error);
  }

  const connectionsWithStats = await Promise.all(connections.map(async (c) => {
    let productCount = 0;
    let orderCount = 0;

    try {
      productCount = await prisma.inventoryLog.count({
        where: { connectionId: c.id }
      });
    } catch (error) {
      productCount = 0;
    }

    try {
      orderCount = await prisma.salesLog.count({
        where: { connectionId: c.id }
      });
    } catch (error) {
      orderCount = 0;
    }

    return {
      id: c.id,
      platform: c.platform,
      storeUrl: c.storeUrl,
      status: c.status,
      lastSync: c.lastSync,
      productCount,
      orderCount
    };
  }));

  res.json({
    success: true,
    connections: connectionsWithStats,
    prokipStats
  });
});

module.exports = router;
