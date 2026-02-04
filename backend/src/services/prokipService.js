/**
 * Legacy Prokip core service (connector/api) has been disabled.
 * All sync operations now go through Prokip-2 /api/ecom/* endpoints.
 */

function disabled(fnName) {
  throw new Error(`${fnName} is disabled. Use /api/ecom/* via prokipEcomClient instead.`);
}

async function authenticateUser() { return disabled('authenticateUser'); }
async function refreshAccessToken() { return disabled('refreshAccessToken'); }
async function saveProkipConfig() { return disabled('saveProkipConfig'); }
async function getValidToken() { return disabled('getValidToken'); }
async function getAuthHeaders() { return disabled('getAuthHeaders'); }
async function getBusinessLocations() { return disabled('getBusinessLocations'); }
async function getProducts() { return disabled('getProducts'); }
async function getInventory() { return disabled('getInventory'); }
async function getProductBySku() { return disabled('getProductBySku'); }
async function createProduct() { return disabled('createProduct'); }
async function recordSale() { return disabled('recordSale'); }
async function processSellReturn() { return disabled('processSellReturn'); }
async function recordPurchase() { return disabled('recordPurchase'); }
async function updateProductStock() { return disabled('updateProductStock'); }
async function getProkipConfig() { return disabled('getProkipConfig'); }
async function getSales() { return disabled('getSales'); }
async function getPurchases() { return disabled('getPurchases'); }
async function isAuthenticated() { return disabled('isAuthenticated'); }
async function clearAuthentication() { return disabled('clearAuthentication'); }
async function saveOpeningStock() { return disabled('saveOpeningStock'); }
async function getOpeningStock() { return disabled('getOpeningStock'); }
async function createStockAdjustment() { return disabled('createStockAdjustment'); }
async function getStockAdjustments() { return disabled('getStockAdjustments'); }
async function adjustStockInProkip() { return disabled('adjustStockInProkip'); }
async function setStockInProkip() { return disabled('setStockInProkip'); }
async function deductStockFromProkip() { return disabled('deductStockFromProkip'); }

module.exports = {
  authenticateUser,
  refreshAccessToken,
  saveProkipConfig,
  getValidToken,
  getAuthHeaders,
  getBusinessLocations,
  getProducts,
  getInventory,
  getProductBySku,
  createProduct,
  recordSale,
  processSellReturn,
  recordPurchase,
  updateProductStock,
  getProkipConfig,
  getSales,
  getPurchases,
  isAuthenticated,
  clearAuthentication,
  saveOpeningStock,
  getOpeningStock,
  createStockAdjustment,
  getStockAdjustments,
  adjustStockInProkip,
  setStockInProkip,
  deductStockFromProkip
};
