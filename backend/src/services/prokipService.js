const axios = require('axios');
const prisma = require('../lib/prisma');

/**
 * Prokip core auth + location utilities are enabled to allow real user login
 * and location selection. All sales/stock sync still uses /api/ecom/*.
 */

function getEnvApiBase() {
  if (process.env.PROKIP_LOCAL_AUTH === 'true') {
    return process.env.PROKIP_BASE_URL || process.env.PROKIP_API || 'https://api.prokip.africa';
  }
  return process.env.PROKIP_API || process.env.PROKIP_BASE_URL || 'https://api.prokip.africa';
}

async function resolveApiBase(userId = null) {
  const envBase = getEnvApiBase();
  if (userId) {
    try {
      const config = await prisma.prokipConfig.findFirst({ where: { userId } });
      if (config?.apiUrl) return config.apiUrl;
    } catch (error) {
      // ignore and fall through
    }
  }

  // Fallback: if explicitly using local Prokip and no per-user apiUrl, use local base
  if (process.env.PROKIP_LOCAL_AUTH === 'true' && process.env.PROKIP_BASE_URL) {
    return process.env.PROKIP_BASE_URL;
  }

  return envBase;
}

async function authenticateUser(username, password) {
  try {
    const oauthBase = getEnvApiBase();
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('email', username); // some Prokip instances expect email field
    formData.append('password', password);
    formData.append('desktop_version', '');
    formData.append('client_id', process.env.PROKIP_CLIENT_ID || '6');
    formData.append('client_secret', process.env.PROKIP_CLIENT_SECRET || '');
    formData.append('grant_type', 'password');
    formData.append('granttype', 'password');
    formData.append('scope', '');

    const response = await axios.post(`${oauthBase}/oauth/token`, formData, {
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      timeout: 60000
    });

    if (!response.data?.access_token) {
      throw new Error('Invalid response format from Prokip API - missing access_token');
    }

    return {
      access_token: response.data.access_token,
      token_type: response.data.token_type || 'Bearer',
      expires_in: response.data.expires_in || 3600,
      refresh_token: response.data.refresh_token,
      scope: response.data.scope || ''
    };
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('Invalid Prokip credentials. Please check your email and password.');
    }
    if (error.response?.status === 400) {
      const oauthError = error.response?.data?.error;
      if (oauthError === 'invalid_client') {
        throw new Error('Invalid Prokip OAuth client configuration. Check PROKIP_CLIENT_ID and PROKIP_CLIENT_SECRET.');
      }
      if (oauthError === 'invalid_grant') {
        throw new Error('Invalid Prokip credentials. Please check your username/email and password.');
      }
      const msg = error.response?.data?.message || error.response?.data?.error_description || 'Invalid request format';
      throw new Error(`Bad request: ${msg}.`);
    }
    throw new Error(error.response?.data?.message || error.response?.data?.error_description || error.message || 'Authentication failed. Please check your credentials.');
  }
}

async function refreshAccessToken(refreshToken) {
  const oauthBase = getEnvApiBase();
  const formData = new URLSearchParams();
  formData.append('grant_type', 'refresh_token');
  formData.append('refresh_token', refreshToken);
  formData.append('client_id', process.env.PROKIP_CLIENT_ID || '6');
  formData.append('client_secret', process.env.PROKIP_CLIENT_SECRET || '');

  const response = await axios.post(`${oauthBase}/oauth/token`, formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  return response.data;
}

async function saveProkipConfig(data, userId = 1) {
  const { access_token, refresh_token, expires_in, locationId } = data;
  const expiresAt = new Date(Date.now() + ((expires_in || 3600) * 1000));

  const existingConfig = await prisma.prokipConfig.findFirst({ where: { userId } });
  if (existingConfig) {
    await prisma.prokipConfig.update({
      where: { id: existingConfig.id },
      data: {
        token: access_token,
        refreshToken: refresh_token || null,
        expiresAt,
        locationId: locationId?.toString() || '',
        updatedAt: new Date()
      }
    });
  } else {
    await prisma.prokipConfig.create({
      data: {
        token: access_token,
        refreshToken: refresh_token || null,
        expiresAt,
        apiUrl: getEnvApiBase(),
        locationId: locationId?.toString() || '',
        userId
      }
    });
  }
}

async function getValidToken(userId = null) {
  if (!userId) return null;
  const config = await prisma.prokipConfig.findFirst({ where: { userId } });
  if (!config?.token) return null;

  if (config.expiresAt && new Date() >= config.expiresAt) {
    if (config.refreshToken) {
      try {
        const newTokenData = await refreshAccessToken(config.refreshToken);
        await saveProkipConfig({
          ...newTokenData,
          locationId: config.locationId
        }, config.userId);
        return newTokenData.access_token;
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  return config.token;
}

async function getBusinessLocations(accessTokenOrUserId) {
  let token = accessTokenOrUserId;
  // If caller passed an access token directly, always use the remote Prokip API base
  let apiBase = (typeof accessTokenOrUserId === 'string')
    ? (process.env.PROKIP_API || getEnvApiBase())
    : getEnvApiBase();

  if (typeof accessTokenOrUserId === 'number') {
    token = await getValidToken(accessTokenOrUserId);
    apiBase = await resolveApiBase(accessTokenOrUserId);
  }

  if (!token) {
    throw new Error('Not authenticated with Prokip. Please log in.');
  }

  const response = await axios.get(`${apiBase}/connector/api/business-location`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    },
    timeout: 60000
  });

  const locations = response.data.data || response.data || [];
  return Array.isArray(locations) ? locations : [];
}

async function isAuthenticated(userId = null) {
  const token = await getValidToken(userId);
  return !!token;
}

async function clearAuthentication(userId = null) {
  if (userId) {
    await prisma.prokipConfig.deleteMany({ where: { userId } });
  } else {
    await prisma.prokipConfig.deleteMany({});
  }
}

function disabled(fnName) {
  throw new Error(`${fnName} is disabled. Use /api/ecom/* via prokipEcomClient instead.`);
}

async function getAuthHeaders(userId = null) {
  const token = await getValidToken(userId);
  if (!token) {
    throw new Error('Not authenticated with Prokip. Please log in.');
  }
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
}

async function getProducts(locationId = null, userId = null) {
  const headers = await getAuthHeaders(userId);
  const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : null;
  const locId = locationId || config?.locationId;
  const apiBase = await resolveApiBase(userId);

  let url = `${apiBase}/connector/api/product?per_page=-1`;
  if (locId) url += `&location_id=${locId}`;

  const response = await axios.get(url, { headers });
  const products = response.data.data || response.data || [];
  return Array.isArray(products) ? products : [];
}

async function getInventory(locationId = null, userId = null) {
  const headers = await getAuthHeaders(userId);
  const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : null;
  const locId = locationId || config?.locationId;
  const apiBase = await resolveApiBase(userId);

  let url = `${apiBase}/connector/api/product-stock-report`;
  if (locId) url += `?location_id=${locId}`;

  const response = await axios.get(url, { headers });
  const items = response.data.data || response.data || [];
  return Array.isArray(items) ? items : [];
}

async function getProductBySku(sku, userId = null) {
  const headers = await getAuthHeaders(userId);
  const apiBase = await resolveApiBase(userId);
  const response = await axios.get(
    `${apiBase}/connector/api/product?sku=${encodeURIComponent(sku)}&per_page=-1`,
    { headers }
  );
  const products = response.data.data || [];
  return products.find(p => p.sku === sku) || null;
}
async function createProduct() { return disabled('createProduct'); }
async function recordSale() { return disabled('recordSale'); }
async function processSellReturn() { return disabled('processSellReturn'); }
async function recordPurchase() { return disabled('recordPurchase'); }
async function updateProductStock() { return disabled('updateProductStock'); }
async function getProkipConfig(userId = null) {
  if (!userId) return await prisma.prokipConfig.findFirst();
  return await prisma.prokipConfig.findFirst({ where: { userId } });
}

async function getSales(locationId = null, startDate = null, endDate = null, userId = null) {
  const headers = await getAuthHeaders(userId);
  const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : null;
  const locId = locationId || config?.locationId;
  const apiBase = await resolveApiBase(userId);

  let url = `${apiBase}/connector/api/sell?per_page=-1`;
  if (locId) url += `&location_id=${locId}`;
  if (startDate) url += `&start_date=${startDate}`;
  if (endDate) url += `&end_date=${endDate}`;

  const response = await axios.get(url, { headers });
  return response.data.data || response.data || [];
}

async function getPurchases(locationId = null, startDate = null, endDate = null, userId = null) {
  const headers = await getAuthHeaders(userId);
  const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : null;
  const locId = locationId || config?.locationId;
  const apiBase = await resolveApiBase(userId);

  let url = `${apiBase}/connector/api/purchase?per_page=-1`;
  if (locId) url += `&location_id=${locId}`;
  if (startDate) url += `&start_date=${startDate}`;
  if (endDate) url += `&end_date=${endDate}`;

  try {
    const response = await axios.get(url, { headers });
    return response.data.data || response.data || [];
  } catch (error) {
    return [];
  }
}
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
  getBusinessLocations,
  isAuthenticated,
  clearAuthentication,
  getAuthHeaders,
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
  saveOpeningStock,
  getOpeningStock,
  createStockAdjustment,
  getStockAdjustments,
  adjustStockInProkip,
  setStockInProkip,
  deductStockFromProkip
};
