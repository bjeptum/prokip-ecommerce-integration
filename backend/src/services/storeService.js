const axios = require('axios');
const OAuth = require('oauth').OAuth;

async function createProductInStore(connection, product) {
  if (connection.platform === 'shopify') {
    await axios.post(`https://${connection.storeUrl}/admin/api/2024-01/products.json`, {
      product: {
        title: product.title,
        variants: [{ sku: product.sku, price: product.price }]
      }
    }, {
      headers: { 'X-Shopify-Access-Token': connection.accessToken }
    });
  } else if (connection.platform === 'woocommerce') {
    const oa = new OAuth(null, null, connection.consumerKey, connection.consumerSecret, '1.0A', null, 'HMAC-SHA1');
    return new Promise((resolve, reject) => {
      oa.post(
        `${connection.storeUrl}/wp-json/wc/v3/products`,
        connection.consumerKey,
        connection.consumerSecret,
        JSON.stringify({
          name: product.name,
          sku: product.sku,
          regular_price: product.price.toString()
        }),
        'application/json',
        (error) => error ? reject(error) : resolve()
      );
    });
  }
}

async function updateInventoryInStore(connection, sku, quantity) {
  // Placeholder - implement per platform
  console.log(`Update ${sku} to ${quantity} in ${connection.platform} store ${connection.storeUrl}`);
}

module.exports = { createProductInStore, updateInventoryInStore };
