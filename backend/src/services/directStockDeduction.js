/**
 * DIRECT PROKIP STOCK DEDUCTION
 * 
 * This function directly deducts stock from Prokip using the correct API endpoint
 */


/**
 * Direct stock deduction is disabled in /api/ecom mode.
 * Use /api/ecom/sync-orders via Prokip-2 instead.
 */
async function deductStockDirectlyFromProkip(products, locationId, reason, userId) {
  throw new Error('Direct stock deduction disabled. Use /api/ecom/sync-orders via Prokip-2.');
}

module.exports = {
  deductStockDirectlyFromProkip
};
