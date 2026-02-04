const axios = require('axios');
const prisma = require('../lib/prisma');

const PROKIP_ECOM_BASE =
  (process.env.PROKIP_BASE_URL || process.env.PROKIP_API || '').replace(/\/$/, '') +
  '/api/ecom';

async function getAuthToken(userId = null) {
  if (!userId) return null;
  const config = await prisma.prokipConfig.findFirst({ where: { userId } });
  return config?.token || null;
}

function buildHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function connectStore(payload, userId) {
  const token = await getAuthToken(userId);
  const response = await axios.post(`${PROKIP_ECOM_BASE}/connect-store`, payload, {
    headers: buildHeaders(token),
    timeout: 30000
  });
  return response.data;
}

async function syncProducts(payload, userId) {
  const token = await getAuthToken(userId);
  const response = await axios.post(`${PROKIP_ECOM_BASE}/sync-products`, payload, {
    headers: buildHeaders(token),
    timeout: 30000
  });
  return response.data;
}

async function syncOrders(payload, userId) {
  const token = await getAuthToken(userId);
  const response = await axios.post(`${PROKIP_ECOM_BASE}/sync-orders`, payload, {
    headers: buildHeaders(token),
    timeout: 30000
  });
  return response.data;
}

async function getStores(userId) {
  const token = await getAuthToken(userId);
  const response = await axios.get(`${PROKIP_ECOM_BASE}/stores`, {
    headers: buildHeaders(token),
    timeout: 30000
  });
  return response.data;
}

async function testConnection(payload, userId) {
  const token = await getAuthToken(userId);
  const response = await axios.post(`${PROKIP_ECOM_BASE}/test-connection`, payload, {
    headers: buildHeaders(token),
    timeout: 30000
  });
  return response.data;
}

async function disconnectStore(storeId, userId) {
  const token = await getAuthToken(userId);
  const response = await axios.delete(`${PROKIP_ECOM_BASE}/disconnect-store/${storeId}`, {
    headers: buildHeaders(token),
    timeout: 30000
  });
  return response.data;
}

async function getSyncStatus(storeId, userId) {
  const token = await getAuthToken(userId);
  const response = await axios.get(`${PROKIP_ECOM_BASE}/sync-status/${storeId}`, {
    headers: buildHeaders(token),
    timeout: 30000
  });
  return response.data;
}

module.exports = {
  connectStore,
  syncProducts,
  syncOrders,
  getStores,
  testConnection,
  disconnectStore,
  getSyncStatus
};
