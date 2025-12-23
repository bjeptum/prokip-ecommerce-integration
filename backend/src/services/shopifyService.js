const axios = require('axios');

async function registerShopifyWebhooks(shop, accessToken) {
  const webhookUrl = process.env.WEBHOOK_URL || `http://localhost:${process.env.PORT}/connections/webhook/shopify`;
  const topics = ['orders/create', 'orders/updated', 'orders/cancelled', 'products/update'];

  for (const topic of topics) {
    try {
      await axios.post(`https://${shop}/admin/api/2024-01/webhooks.json`, {
        webhook: {
          topic,
          address: webhookUrl,
          format: 'json'
        }
      }, {
        headers: { 'X-Shopify-Access-Token': accessToken }
      });
    } catch (error) {
      console.error(`Failed to register ${topic} webhook:`, error.response?.data || error.message);
    }
  }
}

module.exports = { registerShopifyWebhooks };
