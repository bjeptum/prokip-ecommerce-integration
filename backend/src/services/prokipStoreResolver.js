const prokipEcomClient = require('./prokipEcomClient');
const { decryptCredentials } = require('./storeService');

function normalizeUrl(raw) {
  try {
    const withScheme = raw.startsWith('http') ? raw : `https://${raw}`;
    const url = new URL(withScheme);
    const pathname = url.pathname.replace(/\/$/, '');
    return `${url.origin}${pathname}`.toLowerCase();
  } catch {
    return (raw || '').replace(/\/$/, '').toLowerCase();
  }
}

function normalizeOrigin(raw) {
  try {
    const withScheme = raw.startsWith('http') ? raw : `https://${raw}`;
    const url = new URL(withScheme);
    return url.origin.toLowerCase();
  } catch {
    return (raw || '').replace(/\/$/, '').toLowerCase();
  }
}

function getStoresArray(storesResponse) {
  if (!storesResponse) return [];
  if (Array.isArray(storesResponse)) return storesResponse;
  if (Array.isArray(storesResponse.stores)) return storesResponse.stores;
  if (Array.isArray(storesResponse.data)) return storesResponse.data;
  return [];
}

async function resolveProkipStoreId(connection, userId) {
  if (!connection?.storeUrl) return null;

  try {
    const storesResponse = await prokipEcomClient.getStores(userId);
    const stores = getStoresArray(storesResponse);
    const normalizedLocalUrl = normalizeUrl(connection.storeUrl);
    const normalizedLocalOrigin = normalizeOrigin(connection.storeUrl);

    const matched = stores.find((store) => {
      const storeUrl = store.store_url || store.storeUrl || '';
      const normalizedStoreUrl = normalizeUrl(storeUrl);
      const normalizedStoreOrigin = normalizeOrigin(storeUrl);
      return normalizedStoreUrl === normalizedLocalUrl || normalizedStoreOrigin === normalizedLocalOrigin;
    });

    return matched?.id || matched?.store_id || null;
  } catch (error) {
    return null;
  }
}

async function ensureProkipStoreId(connection, userId) {
  if (!connection) return null;

  const existing = await resolveProkipStoreId(connection, userId);
  if (existing) return existing;

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

  return await resolveProkipStoreId(connection, userId);
}

module.exports = {
  resolveProkipStoreId,
  ensureProkipStoreId
};
