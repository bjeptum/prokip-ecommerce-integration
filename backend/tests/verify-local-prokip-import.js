const mysql = require('mysql2/promise');
const prisma = require('../src/lib/prisma');
const prokipLocalAuthService = require('../src/services/prokipLocalAuthService');

function envInt(name, fallback) {
  const raw = process.env[name];
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const config = await prisma.prokipConfig.findFirst();
  assert(config?.locationId, 'No prokip_config found in Postgres. Log in and select a Prokip location first.');

  const locationId = parseInt(config.locationId, 10);
  assert(Number.isFinite(locationId), `Invalid prokip_config.locationId: ${config.locationId}`);

  const mysqlConfig = {
    host: process.env.PROKIP_DB_HOST || '127.0.0.1',
    port: envInt('PROKIP_DB_PORT', 3306),
    user: process.env.PROKIP_DB_USER || 'root',
    password: process.env.PROKIP_DB_PASS || '',
    database: process.env.PROKIP_DB_NAME || 'prokip_ecommerce'
  };

  const nonce = Date.now().toString();
  const testWooId = `999${nonce.slice(-6)}`;
  const testSku = `CODEX_TEST_WOO_${nonce}`;
  const testName = `Codex Test Woo Import ${nonce}`;
  const testQty = 7;
  const testPrice = '13.50';

  console.log('🧪 Verifying local Woo → Prokip import + stock deduction');
  console.log(`- Location ID: ${locationId}`);
  console.log(`- Test SKU: ${testSku}`);

  const importStats = await prokipLocalAuthService.upsertWooProductsToProkip(locationId, [
    {
      id: testWooId,
      sku: testSku,
      name: testName,
      regular_price: testPrice,
      stock_quantity: testQty
    }
  ]);

  console.log('✅ Import completed:', importStats);

  const db = await mysql.createConnection(mysqlConfig);

  try {
    const [productRows] = await db.execute(
      'SELECT id, unit_id, business_id FROM products WHERE sku = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1',
      [testSku]
    );
    assert(productRows.length === 1, 'Imported product not found in MySQL `products` table');

    const productId = productRows[0].id;
    const unitId = productRows[0].unit_id;
    const businessId = productRows[0].business_id;

    console.log(`✅ Product row created: id=${productId}, business_id=${businessId}, unit_id=${unitId}`);
    assert(unitId && unitId !== 0, 'Imported product is missing unit_id (required for Products/Services page)');

    const [plRows] = await db.execute(
      'SELECT product_id, location_id FROM product_locations WHERE product_id = ? AND location_id = ? LIMIT 1',
      [productId, locationId]
    );
    assert(plRows.length === 1, 'Imported product is missing product_locations row for this location');

    const [variationRows] = await db.execute(
      'SELECT id, product_variation_id FROM variations WHERE product_id = ? AND sub_sku = ? AND deleted_at IS NULL LIMIT 1',
      [productId, testWooId]
    );
    assert(variationRows.length === 1, 'Imported product is missing the expected dummy variation');

    const variationId = variationRows[0].id;
    const productVariationId = variationRows[0].product_variation_id;

    const [uiJoinRows] = await db.execute(
      `
        SELECT p.id, p.sku, u.actual_name AS unit, SUM(vld.qty_available) AS current_stock
        FROM products p
        JOIN units u ON p.unit_id = u.id
        JOIN variations v ON v.product_id = p.id AND v.deleted_at IS NULL
        LEFT JOIN variation_location_details vld ON vld.variation_id = v.id AND vld.location_id = ?
        WHERE p.id = ? AND p.deleted_at IS NULL
        GROUP BY p.id, p.sku, u.actual_name
      `,
      [locationId, productId]
    );
    assert(uiJoinRows.length === 1, 'Product does not show in Products/Services join query (unit/variation join failed)');

    const [stockRows] = await db.execute(
      'SELECT qty_available FROM variation_location_details WHERE variation_id = ? AND location_id = ? LIMIT 1',
      [variationId, locationId]
    );
    assert(stockRows.length === 1, 'Imported variation is missing stock row in variation_location_details');

    const qtyAvailable = Number.parseFloat(stockRows[0].qty_available);
    console.log(`✅ Stock row created: variation_id=${variationId}, qty_available=${qtyAvailable}`);
    assert(Math.abs(qtyAvailable - testQty) < 0.0001, 'Imported stock quantity does not match expected value');

    const deduction = await prokipLocalAuthService.deductStockForVariations(locationId, [
      {
        variation_id: variationId,
        product_id: productId,
        product_variation_id: productVariationId,
        quantity: 2
      }
    ]);
    console.log('✅ Stock deduction executed:', deduction);

    const [stockRowsAfter] = await db.execute(
      'SELECT qty_available FROM variation_location_details WHERE variation_id = ? AND location_id = ? LIMIT 1',
      [variationId, locationId]
    );
    const qtyAfter = Number.parseFloat(stockRowsAfter[0].qty_available);
    console.log(`✅ Stock after deduction: ${qtyAfter}`);
    assert(Math.abs(qtyAfter - (testQty - 2)) < 0.0001, 'Stock was not deducted correctly');

    console.log('✅ Verification PASSED');

    console.log('🧹 Cleaning up test rows...');
    await db.execute('DELETE FROM variation_location_details WHERE variation_id = ? AND location_id = ?', [
      variationId,
      locationId
    ]);
    await db.execute('DELETE FROM variations WHERE id = ?', [variationId]);

    if (productVariationId) {
      const [countRows] = await db.execute(
        'SELECT COUNT(*) AS c FROM variations WHERE product_variation_id = ? AND deleted_at IS NULL',
        [productVariationId]
      );
      const remaining = Number.parseInt(countRows?.[0]?.c || 0, 10) || 0;
      if (remaining === 0) {
        await db.execute('DELETE FROM product_variations WHERE id = ?', [productVariationId]);
      }
    }

    await db.execute('DELETE FROM product_locations WHERE product_id = ? AND location_id = ?', [productId, locationId]);
    await db.execute('DELETE FROM products WHERE id = ?', [productId]);

    console.log('✅ Cleanup done');
  } finally {
    await db.end();
  }
}

main()
  .catch((error) => {
    console.error('❌ Verification failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
  });

