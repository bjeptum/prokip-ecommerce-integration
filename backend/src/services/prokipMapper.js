/**
 * Legacy Prokip mapper disabled in /api/ecom mode.
 * All mapping is handled by Prokip-2 /api/ecom/* endpoints.
 */

async function getProkipProductIdBySku() {
  throw new Error('getProkipProductIdBySku disabled. Use /api/ecom/sync-orders.');
}

async function mapOrderToProkipSell() {
  throw new Error('mapOrderToProkipSell disabled. Use /api/ecom/sync-orders.');
}

function mapRefundToProkipProducts() {
  return [];
}

function mapCancellationProducts() {
  return [];
}

module.exports = {
  mapOrderToProkipSell,
  mapRefundToProkipProducts,
  mapCancellationProducts,
  getProkipProductIdBySku
};
