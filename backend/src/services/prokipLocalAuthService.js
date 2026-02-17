const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

let pool;

function getPool() {
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.PROKIP_DB_HOST || '127.0.0.1',
    port: parseInt(process.env.PROKIP_DB_PORT || '3306', 10),
    user: process.env.PROKIP_DB_USER || 'root',
    password: process.env.PROKIP_DB_PASS || '',
    database: process.env.PROKIP_DB_NAME || 'prokip_ecommerce',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
  });

  return pool;
}

function normalizeHash(hash) {
  if (!hash) return hash;
  if (hash.startsWith('$2y$')) {
    return `$2a$${hash.slice(4)}`;
  }
  return hash;
}

async function authenticateUser(identifier, password) {
  const db = getPool();
  const [rows] = await db.execute(
    'SELECT id, username, email, password, business_id, status, allow_login FROM users WHERE username = ? OR email = ? LIMIT 1',
    [identifier, identifier]
  );

  const user = rows[0] || null;
  if (!user) {
    return { success: false, error: 'Invalid Prokip credentials' };
  }

  if (user.status !== 'active' || user.allow_login !== 1) {
    return { success: false, error: 'Prokip account is inactive or login is disabled' };
  }

  const hash = normalizeHash(user.password);
  const isValid = await bcrypt.compare(password, hash);
  if (!isValid) {
    return { success: false, error: 'Invalid Prokip credentials' };
  }

  return { success: true, user };
}

async function getBusinessLocations(businessId) {
  const db = getPool();
  const [rows] = await db.execute(
    `SELECT id, name, city, state, country, mobile, location_id
     FROM business_locations
     WHERE business_id = ? AND is_active = 1`,
    [businessId]
  );

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    city: row.city,
    state: row.state,
    country: row.country,
    mobile: row.mobile,
    location_id: row.location_id
  }));
}

function normalizeLocationId(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? value : parsed;
}

async function getBusinessIdForLocation(locationId) {
  const loc = normalizeLocationId(locationId);
  if (!loc) return null;
  const db = getPool();
  const [rows] = await db.execute(
    'SELECT business_id FROM business_locations WHERE id = ? OR location_id = ? LIMIT 1',
    [loc, loc]
  );
  return rows[0]?.business_id || null;
}

function normalizeSkuKey(value) {
  return (value || '').toString().trim().toLowerCase();
}

async function getSkuVariationMap(locationId) {
  const db = getPool();
  const loc = normalizeLocationId(locationId);
  const businessId = await getBusinessIdForLocation(loc);
  if (!businessId) return new Map();

  const [rows] = await db.execute(
    `
      SELECT v.id AS variation_id,
             v.sub_sku,
             v.product_id,
             v.product_variation_id,
             p.sku AS product_sku
      FROM variations v
      INNER JOIN products p ON p.id = v.product_id
      WHERE p.business_id = ?
        AND v.deleted_at IS NULL
        AND p.deleted_at IS NULL
    `,
    [businessId]
  );

  const map = new Map();

  rows.forEach((row) => {
    const record = {
      variation_id: row.variation_id,
      product_id: row.product_id,
      product_variation_id: row.product_variation_id
    };

    const subSku = normalizeSkuKey(row.sub_sku);
    if (subSku) map.set(subSku, record);

    const productSku = normalizeSkuKey(row.product_sku);
    if (productSku && !map.has(productSku)) {
      map.set(productSku, record);
    }
  });

  return map;
}

async function deductStockForVariations(locationId, items) {
  const loc = normalizeLocationId(locationId);
  if (!loc) throw new Error('Missing location ID for stock deduction');

  const connection = await getPool().getConnection();
  let updated = 0;
  let inserted = 0;

  try {
    await connection.beginTransaction();

    for (const item of items || []) {
      const quantity = Number.parseFloat(item?.quantity || 0);
      if (!quantity || quantity <= 0) continue;

      const variationId = item?.variation_id || item?.variationId;
      const productId = item?.product_id || item?.productId || null;
      const productVariationId = item?.product_variation_id || item?.productVariationId || null;

      if (!variationId) continue;

      const [updateResult] = await connection.execute(
        `UPDATE variation_location_details
         SET qty_available = qty_available - ?, updated_at = NOW()
         WHERE variation_id = ? AND location_id = ?`,
        [quantity, variationId, loc]
      );

      if (updateResult.affectedRows > 0) {
        updated += 1;
        continue;
      }

      await connection.execute(
        `INSERT INTO variation_location_details
          (product_id, product_variation_id, variation_id, location_id, qty_available, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [productId, productVariationId, variationId, loc, 0 - quantity]
      );

      inserted += 1;
    }

    await connection.commit();

    return {
      success: true,
      updated,
      inserted
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // ignore rollback errors
    }

    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Set an exact stock quantity for a given variation at a location.
 * Creates the location detail row if it does not yet exist.
 */
async function setStockForVariation(locationId, variationId, quantity) {
  const loc = normalizeLocationId(locationId);
  if (!loc) throw new Error('Missing location ID for stock update');

  const qty = Number.parseFloat(quantity);
  if (!Number.isFinite(qty)) {
    throw new Error('Invalid quantity supplied for stock update');
  }

  const connection = await getPool().getConnection();
  try {
    const [existingRows] = await connection.execute(
      `SELECT id, product_id, product_variation_id 
       FROM variation_location_details 
       WHERE variation_id = ? AND location_id = ? 
       LIMIT 1`,
      [variationId, loc]
    );

    if (existingRows.length > 0) {
      await connection.execute(
        `UPDATE variation_location_details 
         SET qty_available = ?, updated_at = NOW() 
         WHERE id = ?`,
        [qty, existingRows[0].id]
      );
      return { updated: true, inserted: false, variationId };
    }

    // Look up variation metadata so the insert stays consistent with Prokip schema.
    const [variationRows] = await connection.execute(
      `SELECT product_id, product_variation_id 
       FROM variations 
       WHERE id = ? 
       LIMIT 1`,
      [variationId]
    );

    const variationMeta = variationRows?.[0] || {};

    await connection.execute(
      `INSERT INTO variation_location_details
        (product_id, product_variation_id, variation_id, location_id, qty_available, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        variationMeta.product_id || null,
        variationMeta.product_variation_id || null,
        variationId,
        loc,
        qty
      ]
    );
    return { updated: false, inserted: true, variationId };
  } finally {
    connection.release();
  }
}

/**
 * Convenience helper: set stock by SKU (or sub_sku) instead of variation id.
 * Relies on the SKU→variation map for the provided location.
 */
async function setStockForSku(locationId, sku, quantity) {
  const normalizedSku = normalizeSkuKey(sku);
  if (!normalizedSku) {
    throw new Error('SKU is required for stock update');
  }

  const map = await getSkuVariationMap(locationId);
  if (!map.has(normalizedSku)) {
    throw new Error(`No Prokip variation found for SKU ${sku}`);
  }

  const record = map.get(normalizedSku);
  const variationId = record?.variation_id || record?.id || record;

  return await setStockForVariation(locationId, variationId, quantity);
}

async function getProducts(locationId) {
  const db = getPool();
  const loc = normalizeLocationId(locationId);
  const businessId = await getBusinessIdForLocation(loc);
  if (!businessId) return [];

  const [rows] = await db.execute(`
    SELECT p.id, p.name, p.sku,
           v.id AS variation_id,
           v.sell_price_inc_tax,
           v.default_sell_price,
           vld.qty_available
    FROM products p
    LEFT JOIN variations v ON v.product_id = p.id AND v.deleted_at IS NULL
    LEFT JOIN variation_location_details vld
      ON vld.variation_id = v.id AND vld.location_id = ?
    WHERE p.business_id = ?
      AND (p.is_inactive = 0 OR p.is_inactive IS NULL)
      AND (p.not_for_selling = 0 OR p.not_for_selling IS NULL)
      AND p.deleted_at IS NULL
    ORDER BY p.id DESC
  `, [loc, businessId]);

  const products = new Map();
  rows.forEach(row => {
    let product = products.get(row.id);
    if (!product) {
      product = {
        id: row.id,
        name: row.name,
        sku: row.sku,
        sell_price_inc_tax: row.sell_price_inc_tax || row.default_sell_price || 0,
        // Null means "no stock data for this location", so we don't overwrite store stock with 0.
        qty_available: null
      };
      products.set(row.id, product);
    }

    if (row.qty_available !== null && row.qty_available !== undefined) {
      const qty = parseFloat(row.qty_available);
      if (!Number.isNaN(qty)) {
        product.qty_available = (product.qty_available ?? 0) + qty;
      }
    }

    if (!product.sell_price_inc_tax && (row.sell_price_inc_tax || row.default_sell_price)) {
      product.sell_price_inc_tax = row.sell_price_inc_tax || row.default_sell_price;
    }
  });

  const sorted = Array.from(products.values()).sort((a, b) => {
    const aq = a.qty_available;
    const bq = b.qty_available;
    const aHas = aq !== null && aq !== undefined;
    const bHas = bq !== null && bq !== undefined;
    if (aHas && bHas) {
      if (bq !== aq) return bq - aq;
    } else if (aHas !== bHas) {
      return aHas ? -1 : 1; // place known stock before unknown
    }
    return (a.name || '').localeCompare(b.name || '');
  });

  return sorted;
}

async function getSales(locationId) {
  const db = getPool();
  const loc = normalizeLocationId(locationId);
  const businessId = await getBusinessIdForLocation(loc);
  if (!businessId) return [];

  const [rows] = await db.execute(`
    SELECT t.id, t.invoice_no, t.ref_no, t.transaction_date,
           t.final_total, t.status, t.created_by,
           c.name AS contact_name,
           COUNT(tsl.id) AS line_count
    FROM transactions t
    LEFT JOIN contacts c ON t.contact_id = c.id
    LEFT JOIN transaction_sell_lines tsl ON tsl.transaction_id = t.id
    WHERE t.business_id = ?
      AND t.type IN ('sell','sell_return')
      AND (? IS NULL OR t.location_id = ?)
    GROUP BY t.id
    ORDER BY t.transaction_date DESC
    LIMIT 200
  `, [businessId, loc, loc]);

  return rows.map(row => ({
    id: row.id,
    invoice_no: row.invoice_no,
    ref_no: row.ref_no,
    transaction_date: row.transaction_date,
    final_total: row.final_total,
    status: row.status,
    added_by: row.created_by,
    contact: row.contact_name ? { name: row.contact_name } : null,
    sell_lines: new Array(row.line_count || 0)
  }));
}

async function getPurchases(locationId) {
  const db = getPool();
  const loc = normalizeLocationId(locationId);
  const businessId = await getBusinessIdForLocation(loc);
  if (!businessId) return [];

  const [rows] = await db.execute(`
    SELECT t.id, t.ref_no, t.transaction_date,
           t.final_total, t.status, t.created_by,
           c.supplier_business_name, c.name AS contact_name,
           COUNT(pl.id) AS line_count
    FROM transactions t
    LEFT JOIN contacts c ON t.contact_id = c.id
    LEFT JOIN purchase_lines pl ON pl.transaction_id = t.id
    WHERE t.business_id = ?
      AND t.type = 'purchase'
      AND (? IS NULL OR t.location_id = ?)
    GROUP BY t.id
    ORDER BY t.transaction_date DESC
    LIMIT 200
  `, [businessId, loc, loc]);

  return rows.map(row => ({
    id: row.id,
    ref_no: row.ref_no,
    transaction_date: row.transaction_date,
    final_total: row.final_total,
    status: row.status,
    added_by: row.created_by,
    contact: row.supplier_business_name || row.contact_name
      ? { name: row.supplier_business_name || row.contact_name }
      : null,
    purchase_lines: new Array(row.line_count || 0)
  }));
}

function normalizeWooSku(value) {
  const trimmed = (value || '').toString().trim();
  return trimmed.length ? trimmed : null;
}

function toDecimal(value, fallback = 0) {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : fallback;
}

function toInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function getDefaultUnitIdForBusiness(connection, businessId) {
  // Prokip ProductController (Products/Services page) inner-joins `units`,
  // so imported products MUST have a valid `unit_id` to be visible in the UI.
  try {
    const [rows] = await connection.execute(
      `SELECT id FROM units WHERE business_id = ? ORDER BY id ASC LIMIT 1`,
      [businessId]
    );
    if (rows?.[0]?.id) return rows[0].id;
  } catch {
    // Ignore and fall back to any unit.
  }

  const [fallbackRows] = await connection.execute(
    `SELECT id FROM units ORDER BY id ASC LIMIT 1`
  );
  if (fallbackRows?.[0]?.id) return fallbackRows[0].id;

  throw new Error(
    'No units found in Prokip database. Create a unit (e.g. "Piece") in Prokip and retry syncing products.'
  );
}

/**
 * Import WooCommerce products into the Prokip MySQL tables so they appear in
 * the Prokip dashboard views and can be used for stock deduction.
 *
 * Strategy:
 * - `products.sku` uses the Woo SKU when present (else Woo product ID).
 * - `variations.sub_sku` always uses the Woo product ID (string). This enables
 *   order mapping when Woo line items don't include SKU but do include product_id.
 */
async function upsertWooProductsToProkip(locationId, wooProducts, options = {}) {
  const loc = normalizeLocationId(locationId);
  if (!loc) throw new Error('Missing location ID for product import');

  const businessId = await getBusinessIdForLocation(loc);
  if (!businessId) throw new Error(`No business found for location ${loc}`);

  const connection = await getPool().getConnection();
  const stats = {
    products_created: 0,
    products_updated: 0,
    variations_created: 0,
    variations_updated: 0,
    product_locations_created: 0,
    product_locations_updated: 0,
    stock_rows_created: 0,
    stock_rows_updated: 0,
    stock_rows_skipped: 0,
    skipped: 0
  };

  try {
    await connection.beginTransaction();

    const defaultUnitId = await getDefaultUnitIdForBusiness(connection, businessId);

    const overwriteStock = options.overwriteStock !== false; // default true to repair over-pulls

    for (const product of wooProducts || []) {
      const wooId = normalizeWooSku(product?.id);
      if (!wooId) {
        stats.skipped += 1;
        continue;
      }

      const productSku = normalizeWooSku(product?.sku) || wooId;
      const subSku = wooId; // Always Woo product ID for order mapping fallbacks
      const name = (product?.name || product?.slug || `Woo product ${wooId}`).toString();
      const price = toDecimal(product?.regular_price ?? product?.price ?? 0, 0);
      const quantity = toDecimal(product?.stock_quantity ?? 0, 0);

      // Upsert product by (business_id, sku)
      const [existingProductRows] = await connection.execute(
        `SELECT id, unit_id FROM products
         WHERE business_id = ? AND sku = ? AND deleted_at IS NULL
         LIMIT 1`,
        [businessId, productSku]
      );

      let productId;
      const isExistingProduct = existingProductRows.length > 0;

      if (isExistingProduct) {
        productId = existingProductRows[0].id;
        await connection.execute(
          `UPDATE products
           SET name = ?,
               type = 'single',
               unit_id = CASE WHEN unit_id IS NULL OR unit_id = 0 THEN ? ELSE unit_id END,
               enable_stock = 1,
               not_for_selling = 0,
               is_inactive = 0,
               updated_at = NOW()
           WHERE id = ?`,
          [name, defaultUnitId, productId]
        );
        stats.products_updated += 1;
      } else {
        const [insertResult] = await connection.execute(
          `INSERT INTO products
            (business_id, name, type, sku, unit_id, enable_stock, not_for_selling, is_inactive, is_service, created_at, updated_at)
           VALUES (?, ?, 'single', ?, ?, 1, 0, 0, 0, NOW(), NOW())`,
          [businessId, name, productSku, defaultUnitId]
        );
        productId = insertResult.insertId;
        stats.products_created += 1;
      }

      // Ensure product is assigned to this location so it appears in the Prokip UI.
      const [plResult] = await connection.execute(
        `INSERT INTO product_locations (product_id, location_id, created_at, updated_at)
         VALUES (?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE updated_at = NOW()`,
        [productId, loc]
      );
      if (plResult.affectedRows > 1) {
        stats.product_locations_updated += 1;
      } else {
        stats.product_locations_created += 1;
      }

      // Ensure dummy product variation group
      const [variationGroupRows] = await connection.execute(
        `SELECT id FROM product_variations
         WHERE product_id = ? AND is_dummy = 1
         LIMIT 1`,
        [productId]
      );

      let productVariationId;
      if (variationGroupRows.length > 0) {
        productVariationId = variationGroupRows[0].id;
      } else {
        const [insertGroupResult] = await connection.execute(
          `INSERT INTO product_variations
            (product_id, name, is_dummy, created_at, updated_at)
           VALUES (?, 'DUMMY', 1, NOW(), NOW())`,
          [productId]
        );
        productVariationId = insertGroupResult.insertId;
      }

      // Upsert variation by (product_id, sub_sku)
      const [existingVariationRows] = await connection.execute(
        `SELECT id FROM variations
         WHERE product_id = ? AND sub_sku = ? AND deleted_at IS NULL
         LIMIT 1`,
        [productId, subSku]
      );

      let variationId;
      if (existingVariationRows.length > 0) {
        variationId = existingVariationRows[0].id;
        // Keep existing pricing/stock to avoid double updates when re-pulling
        if (!isExistingProduct || overwriteStock) {
          await connection.execute(
            `UPDATE variations
             SET product_variation_id = ?, name = ?, default_sell_price = ?, sell_price_inc_tax = ?, updated_at = NOW()
             WHERE id = ?`,
            [productVariationId, 'DUMMY', price, price, variationId]
          );
        }
        stats.variations_updated += 1;
      } else {
        const [insertVariationResult] = await connection.execute(
          `INSERT INTO variations
            (product_id, product_variation_id, name, sub_sku, default_purchase_price, dpp_inc_tax, profit_percent, default_sell_price, sell_price_inc_tax, created_at, updated_at)
           VALUES (?, ?, 'DUMMY', ?, 0, 0, 0, ?, ?, NOW(), NOW())`,
          [productId, productVariationId, subSku, price, price]
        );
        variationId = insertVariationResult.insertId;
        stats.variations_created += 1;
      }

      // Upsert location stock row
      const [existingStockRows] = await connection.execute(
        `SELECT id FROM variation_location_details
         WHERE variation_id = ? AND location_id = ?
         LIMIT 1`,
        [variationId, loc]
      );

      if (existingStockRows.length > 0) {
        if (!isExistingProduct || overwriteStock) {
          await connection.execute(
            `UPDATE variation_location_details
             SET qty_available = ?, updated_at = NOW()
             WHERE id = ?`,
            [quantity, existingStockRows[0].id]
          );
          stats.stock_rows_updated += 1;
        } else {
          stats.stock_rows_skipped = (stats.stock_rows_skipped || 0) + 1;
        }
      } else {
        await connection.execute(
          `INSERT INTO variation_location_details
            (product_id, product_variation_id, variation_id, location_id, qty_available, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
          [productId, productVariationId, variationId, loc, quantity]
        );
        stats.stock_rows_created += 1;
      }
    }

    await connection.commit();
    return stats;
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // ignore rollback errors
    }
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  authenticateUser,
  getBusinessLocations,
  getBusinessIdForLocation,
  getSkuVariationMap,
  deductStockForVariations,
  setStockForVariation,
  setStockForSku,
  getProducts,
  getSales,
  getPurchases,
  upsertWooProductsToProkip,
  getRecentSellLines
};

/**
 * Fetch recent Prokip sale lines for a location.
 * @param {number|string|null} locationId
 * @param {number} minutesAgo - lookback window in minutes
 * @returns {Promise<Array<{sku:string, sub_sku:string, quantity:number}>>}
 */
async function getRecentSellLines(locationId, minutesAgo = 1440) {
  const db = getPool();
  const loc = normalizeLocationId(locationId);
  const businessId = await getBusinessIdForLocation(loc);
  if (!businessId) return [];

  const [rows] = await db.execute(
    `
      SELECT 
        COALESCE(v.sub_sku, tsl.sub_sku, p.sku) AS sub_sku,
        p.sku AS product_sku,
        tsl.quantity
      FROM transactions t
      JOIN transaction_sell_lines tsl ON tsl.transaction_id = t.id
      LEFT JOIN variations v ON v.id = tsl.variation_id
      LEFT JOIN products p ON p.id = tsl.product_id
      WHERE t.business_id = ?
        AND t.type = 'sell'
        AND t.status IN ('final','completed','paid','processing','pending')
        AND (? IS NULL OR t.location_id = ?)
        AND t.transaction_date >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
    `,
    [businessId, loc, loc, parseInt(minutesAgo, 10) || 1440]
  );

  return rows.map((row) => ({
    sku: row.product_sku,
    sub_sku: row.sub_sku,
    quantity: Number.parseFloat(row.quantity || 0) || 0
  }));
}
