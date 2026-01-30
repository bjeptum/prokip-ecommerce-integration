// Add to prokipService.js
async function adjustStockInProkip(sku, quantity, userId = null) {
  const headers = await getAuthHeaders(userId);
  const endpoints = ['/connector/api/stock-adjustments', '/connector/api/inventory-adjustments'];
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios.post(`https://api.prokip.africa${endpoint}`, {
        location_id: 21237,
        reason: `WooCommerce sale - ${sku}`,
        products: [{ product_id: parseInt(sku), quantity: -quantity }]
      }, { headers });
      return response.data;
    } catch (e) { continue; }
  }
  throw new Error('Stock adjustment failed');
}
