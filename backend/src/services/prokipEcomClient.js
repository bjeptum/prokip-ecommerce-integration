const axios = require('axios');
const prisma = require('../lib/prisma');

function normalizeBaseUrl(rawBaseUrl) {
  if (!rawBaseUrl) return '';

  const trimmed = String(rawBaseUrl).trim().replace(/\/$/, '');
  if (!trimmed) return '';

  // Ensure URL parsing works even if user passed "localhost:8000"
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  try {
    const url = new URL(withScheme);

    // Local dev: prefer IPv4 to avoid "localhost" resolving to ::1 on some machines.
    if (url.hostname === 'localhost' || url.hostname === '::1') {
      url.hostname = '127.0.0.1';
    }

    // Keep any non-root pathname (in case the app is hosted under a subpath)
    url.pathname = url.pathname.replace(/\/$/, '');

    return `${url.origin}${url.pathname}`.replace(/\/$/, '');
  } catch {
    return trimmed;
  }
}

function getProkipEcomBaseUrl() {
  const rawBase =
    process.env.PROKIP_ECOM_BASE_URL ||
    process.env.PROKIP_BASE_URL ||
    process.env.PROKIP_API ||
    '';

  const normalizedBase = normalizeBaseUrl(rawBase);
  if (!normalizedBase) {
    throw new Error(
      'Missing PROKIP_BASE_URL. Set it to your Prokip-2 server URL (example: http://127.0.0.1:8000) and restart the backend.'
    );
  }

  if (/\/api\/ecom\/?$/i.test(normalizedBase)) {
    return normalizedBase.replace(/\/$/, '');
  }

  return `${normalizedBase}/api/ecom`;
}

async function getAuthToken(userId = null) {
  if (process.env.PROKIP_ECOM_TOKEN) return process.env.PROKIP_ECOM_TOKEN;
  if (!userId) return null;
  const config = await prisma.prokipConfig.findFirst({ where: { userId } });
  return config?.token || null;
}

function buildHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { 
      Authorization: `Bearer ${token}`,
      'API-TOKEN': token
    } : {})
  };
}

function formatProkipEcomError(error, fullUrl) {
  const baseHint =
    'Verify PROKIP_BASE_URL points to your Prokip-2 server. For localhost dev, use http://127.0.0.1:8000 (not http://localhost:8000) to avoid IPv6 (::1) connection issues.';
  const tokenHint =
    'Verify PROKIP_ECOM_TOKEN is set in backend/.env (it is sent as both `Authorization: Bearer` and `API-TOKEN`).';

  // Axios network errors
  if (error?.code === 'ECONNREFUSED') {
    return new Error(`Prokip-2 is not reachable (${fullUrl}). ${baseHint} Details: ${error.message}`);
  }

  if (error?.code === 'ENOTFOUND') {
    return new Error(`Prokip-2 host not found (${fullUrl}). ${baseHint} Details: ${error.message}`);
  }

  // Axios HTTP errors
  const status = error?.response?.status;
  if (status) {
    const serverMessage =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.response?.data?.errors ||
      null;

    const detail = serverMessage ? ` Details: ${typeof serverMessage === 'string' ? serverMessage : JSON.stringify(serverMessage)}` : '';

    const extraHint = status === 401 || status === 403
      ? ` ${tokenHint}`
      : status === 404
        ? ' Verify the Prokip-2 e-commerce module is running and exposes `/api/ecom/*` routes.'
        : '';

    return new Error(`Prokip-2 API error (${status}) at ${fullUrl}.${detail}${extraHint}`);
  }

  return error;
}

async function connectStore(payload, userId) {
  const token = await getAuthToken(userId);
  const baseUrl = getProkipEcomBaseUrl();
  const url = `${baseUrl}/connect-store`;
  try {
    const response = await axios.post(url, payload, {
      headers: buildHeaders(token),
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    throw formatProkipEcomError(error, url);
  }
}

async function syncProducts(payload, userId) {
  const token = await getAuthToken(userId);
  const baseUrl = getProkipEcomBaseUrl();
  const url = `${baseUrl}/sync-products`;
  try {
    const response = await axios.post(url, payload, {
      headers: buildHeaders(token),
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    throw formatProkipEcomError(error, url);
  }
}

async function syncOrders(payload, userId) {
  const token = await getAuthToken(userId);
  const baseUrl = getProkipEcomBaseUrl();
  const url = `${baseUrl}/sync-orders`;
  try {
    const response = await axios.post(url, payload, {
      headers: buildHeaders(token),
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    throw formatProkipEcomError(error, url);
  }
}

async function getProducts(params = {}, userId) {
  const token = await getAuthToken(userId);
  const baseUrl = getProkipEcomBaseUrl();
  const url = `${baseUrl}/products`;
  try {
    const response = await axios.get(url, {
      headers: buildHeaders(token),
      params,
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    throw formatProkipEcomError(error, url);
  }
}

async function createOrder(payload, userId) {
  const token = await getAuthToken(userId);
  const baseUrl = getProkipEcomBaseUrl();
  const url = `${baseUrl}/orders`;
  try {
    const response = await axios.post(url, payload, {
      headers: buildHeaders(token),
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    throw formatProkipEcomError(error, url);
  }
}

async function getStores(userId) {
  const token = await getAuthToken(userId);
  const baseUrl = getProkipEcomBaseUrl();
  const url = `${baseUrl}/stores`;
  try {
    const response = await axios.get(url, {
      headers: buildHeaders(token),
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    throw formatProkipEcomError(error, url);
  }
}

async function testConnection(payload, userId) {
  const token = await getAuthToken(userId);
  const baseUrl = getProkipEcomBaseUrl();
  const url = `${baseUrl}/test-connection`;
  try {
    const response = await axios.post(url, payload, {
      headers: buildHeaders(token),
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    throw formatProkipEcomError(error, url);
  }
}

async function disconnectStore(storeId, userId) {
  const token = await getAuthToken(userId);
  const baseUrl = getProkipEcomBaseUrl();
  const url = `${baseUrl}/disconnect-store/${storeId}`;
  try {
    const response = await axios.delete(url, {
      headers: buildHeaders(token),
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    throw formatProkipEcomError(error, url);
  }
}

async function getSyncStatus(storeId, userId) {
  const token = await getAuthToken(userId);
  const baseUrl = getProkipEcomBaseUrl();
  const url = `${baseUrl}/sync-status/${storeId}`;
  try {
    const response = await axios.get(url, {
      headers: buildHeaders(token),
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    throw formatProkipEcomError(error, url);
  }
}

module.exports = {
  connectStore,
  syncProducts,
  syncOrders,
  getProducts,
  createOrder,
  getStores,
  testConnection,
  disconnectStore,
  getSyncStatus
};
