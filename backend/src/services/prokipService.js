const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Prokip OAuth credentials
const PROKIP_CLIENT_ID = '6';
const PROKIP_CLIENT_SECRET = 'vkbDU9dKp3iO3h0Yjc3C9sRSmnvBsq5qdtMTEarK';

/**
 * Prokip Service - Handles all interactions with Prokip API
 * Replaces mock data with real API calls when MOCK_PROKIP=false
 */

/**
 * Authenticate user with Prokip and get access token
 * @param {string} username - Prokip username/email
 * @param {string} password - Prokip password
 * @returns {Promise<Object>} - Token data including access_token, refresh_token, expires_in
 */
async function authenticateUser(username, password) {
  try {
    console.log('🔐 Attempting Prokip authentication with real API...');
    console.log('📧 Username:', username);
    console.log('🌐 API URL:', process.env.PROKIP_API);
    console.log('🔑 Client ID:', process.env.PROKIP_CLIENT_ID);
    
    // Create form data exactly as specified in the API documentation
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('desktop_version', ''); // Empty as per specification
    formData.append('client_id', process.env.PROKIP_CLIENT_ID || '6');
    formData.append('client_secret', process.env.PROKIP_CLIENT_SECRET || 'vkbDU9dKp3iO3h0Yjc3C9sRSmnvBsq5qdtMTEarK');
    formData.append('grant_type', 'password');
    formData.append('granttype', 'password'); // Both as per specification
    formData.append('scope', ''); // Empty as per specification

    console.log('📤 Sending request to:', `${process.env.PROKIP_API}/oauth/token`);
    console.log('📋 Form data:', Object.fromEntries(formData.entries()));

    const response = await axios.post(`${process.env.PROKIP_API}/oauth/token`, formData, {
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000 // 15 second timeout
    });

    console.log('✅ Real Prokip authentication successful!');
    console.log('📦 Response:', response.data);
    
    // Validate response format matches expected structure
    if (!response.data.access_token) {
      throw new Error('Invalid response format from Prokip API - missing access_token');
    }
    
    // Ensure response has expected fields
    const tokenData = {
      access_token: response.data.access_token,
      token_type: response.data.token_type || 'Bearer',
      expires_in: response.data.expires_in || 3600,
      refresh_token: response.data.refresh_token,
      scope: response.data.scope || ''
    };
    
    console.log('✅ Token validation successful');
    return tokenData;
    
  } catch (error) {
    console.error('❌ Real Prokip authentication failed:');
    console.error('   Error:', error.message);
    console.error('   Code:', error.code);
    console.error('   Status:', error.response?.status);
    console.error('   Response:', error.response?.data);
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error(`Cannot connect to Prokip API at ${process.env.PROKIP_API}. Please check your internet connection or contact support.`);
    }
    
    if (error.response?.status === 401) {
      throw new Error('Invalid Prokip credentials. Please check your email and password.');
    }
    
    if (error.response?.status === 400) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error_description || 'Invalid request format';
      throw new Error(`Bad request: ${errorMessage}. Please check your credentials.`);
    }
    
    throw new Error(error.response?.data?.message || error.response?.data?.error_description || error.message || 'Authentication failed. Please check your credentials.');
  }
}

/**
 * Refresh expired access token
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<Object>} - New token data
 */
async function refreshAccessToken(refreshToken) {
  try {
    const formData = new URLSearchParams();
    formData.append('grant_type', 'refresh_token');
    formData.append('refresh_token', refreshToken);
    formData.append('client_id', PROKIP_CLIENT_ID);
    formData.append('client_secret', PROKIP_CLIENT_SECRET);

    const response = await axios.post(`${process.env.PROKIP_API}/oauth/token`, formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    return response.data;
  } catch (error) {
    console.error('Token refresh failed:', error.response?.data || error.message);
    throw new Error('Session expired. Please log in again.');
  }
}

/**
 * Store Prokip config in database
 * @param {Object} data - Token and config data
 * @param {number} userId - User ID
 */
async function saveProkipConfig(data, userId = 1) {
  const { access_token, refresh_token, expires_in, locationId } = data;
  
  console.log('🔍 saveProkipConfig called:');
  console.log('  - userId:', userId);
  console.log('  - access_token length:', access_token ? access_token.length : 'null');
  console.log('  - access_token preview:', access_token ? access_token.substring(0, 50) + '...' : 'null');
  console.log('  - locationId:', locationId);
  
  // Calculate expiration time
  const expiresAt = new Date(Date.now() + (expires_in * 1000));

  // First try to find existing config for this user
  const existingConfig = await prisma.prokipConfig.findFirst({ where: { userId } });
  
  console.log('  - existingConfig found:', !!existingConfig);
  if (existingConfig) {
    console.log('  - existing token length:', existingConfig.token ? existingConfig.token.length : 'null');
    console.log('  - existing token preview:', existingConfig.token ? existingConfig.token.substring(0, 50) + '...' : 'null');
  }
  
  if (existingConfig) {
    // Update existing config
    console.log('🔄 Updating existing config...');
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
    console.log('✅ Config updated successfully');
  } else {
    // Create new config
    console.log('➕ Creating new config...');
    await prisma.prokipConfig.create({
      data: {
        token: access_token,
        refreshToken: refresh_token || null,
        expiresAt,
        apiUrl: process.env.PROKIP_API,
        locationId: locationId?.toString() || '',
        userId
      }
    });
    console.log('✅ Config created successfully');
  }
}

/**
 * Get valid access token, refreshing if necessary
 * @returns {Promise<string|null>} - Valid access token or null
 */
async function getValidToken(userId = null) {
  if (!userId) {
    console.warn('⚠️ getValidToken called without userId');
    return null;
  }
  
  const config = await prisma.prokipConfig.findFirst({ where: { userId } });
  
  if (!config || !config.token) {
    console.warn('⚠️ No Prokip config found for user:', userId);
    return null;
  }

  // Check if token is expired
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
        console.error('Failed to refresh token:', error.message);
        return null;
      }
    }
    return null;
  }

  return config.token;
}

/**
 * Get Prokip API headers with valid token
 * @returns {Promise<Object>} - Headers object
 */
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

/**
 * Get business locations for authenticated user
 * @param {string} token - Access token
 * @returns {Promise<Array>} - List of business locations
 */
async function getBusinessLocations(token) {
  try {
    console.log('📍 Fetching business locations from real Prokip API...');
    console.log('🔗 URL:', `${process.env.PROKIP_API}/connector/api/business-location`);
    
    const response = await axios.get(`${process.env.PROKIP_API}/connector/api/business-location`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      },
      timeout: 15000
    });
    
    console.log('✅ Business locations fetched successfully');
    console.log('📍 Number of locations:', response.data.data?.length || response.data?.length || 0);
    
    // Handle different response formats
    const locations = response.data.data || response.data || [];
    return Array.isArray(locations) ? locations : [];
    
  } catch (error) {
    console.error('Failed to fetch business locations:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      throw new Error('Session expired. Please log in again.');
    }
    
    if (error.response?.status === 403) {
      throw new Error('Access denied. Please check your permissions.');
    }
    
    throw new Error('Could not load your business locations. Please try again.');
  }
}

/**
 * Get products from Prokip inventory
 * @param {number} locationId - Business location ID
 * @param {number} userId - User ID
 * @returns {Promise<Array>} - List of products
 */
async function getProducts(locationId = null, userId = null) {
  try {
    if (!userId) {
      console.warn('⚠️ getProducts called without userId');
      return [];
    }
    
    console.log('🌐 Fetching products from real Prokip API for user:', userId);
    const headers = await getAuthHeaders(userId);
    const config = await prisma.prokipConfig.findFirst({ where: { userId } });
    const locId = locationId || config?.locationId;
    
    if (!config || !config.token) {
      console.warn('⚠️ No Prokip config found for user:', userId);
      return [];
    }
    
    let url = `${process.env.PROKIP_API}/connector/api/product?per_page=-1`;
    if (locId) {
      url += `&location_id=${locId}`;
    }

    console.log('🔗 Fetching from URL:', url);
    console.log('🔑 Using headers:', headers);

    const response = await axios.get(url, { headers, timeout: 15000 });
    console.log('📡 Products response status:', response.status);
    console.log('📦 Products response data structure:', Object.keys(response.data));
    
    // Handle different response formats
    const products = response.data.data || response.data || [];
    console.log('📦 Number of products fetched:', products.length);
    
    return Array.isArray(products) ? products : [];
    
  } catch (error) {
    console.error('Failed to fetch Prokip products:', error.response?.data || error.message);
    console.error('Full error:', error);
    
    if (error.response?.status === 401) {
      throw new Error('Session expired. Please log in again.');
    }
    
    if (error.response?.status === 403) {
      throw new Error('Access denied. Please check your permissions.');
    }
    
    throw new Error('Could not load products from Prokip. Please check your connection.');
  }
}

/**
 * Get inventory/stock report from Prokip
 * @param {number} locationId - Business location ID
 * @returns {Promise<Array>} - Stock data
 */
async function getInventory(locationId = null, userId = null) {
  try {
    const headers = await getAuthHeaders(userId);
    const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : await prisma.prokipConfig.findUnique({ where: { id: 1 } });
    const locId = locationId || config?.locationId;
    
    let url = `${process.env.PROKIP_API}/connector/api/product-stock-report`;
    if (locId) {
      url += `?location_id=${locId}`;
    }

    const response = await axios.get(url, { headers });
    return response.data.data || response.data || [];
  } catch (error) {
    console.error('Failed to fetch Prokip inventory:', error.response?.data || error.message);
    throw new Error('Could not load inventory from Prokip. Please check your connection.');
  }
}

/**
 * Get product by SKU
 * @param {string} sku - Product SKU
 * @returns {Promise<Object|null>} - Product data or null
 */
async function getProductBySku(sku, userId = null) {
  try {
    const headers = await getAuthHeaders(userId);
    const response = await axios.get(
      `${process.env.PROKIP_API}/connector/api/product?sku=${encodeURIComponent(sku)}&per_page=-1`,
      { headers }
    );
    
    const products = response.data.data || [];
    return products.find(p => p.sku === sku) || null;
  } catch (error) {
    console.error(`Failed to fetch product with SKU ${sku}:`, error.response?.data || error.message);
    return null;
  }
}

/**
 * Create a new product in Prokip
 * @param {Object} productData - Product details
 * @returns {Promise<Object>} - Created product
 */
async function createProduct(productData, userId = null) {
  try {
    const headers = await getAuthHeaders(userId);
    const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : await prisma.prokipConfig.findUnique({ where: { id: 1 } });
    
    const payload = {
      name: productData.name,
      sku: productData.sku,
      sell_price: parseFloat(productData.sellPrice || 0),
      purchase_price: parseFloat(productData.purchasePrice || 0),
      initial_quantity: parseInt(productData.quantity || 0),
      location_id: productData.locationId || config?.locationId
    };

    const response = await axios.post(
      `${process.env.PROKIP_API}/connector/api/product`,
      payload,
      { headers }
    );
    
    return response.data.data || response.data;
  } catch (error) {
    console.error('Failed to create product in Prokip:', error.response?.data || error.message);
    throw new Error('Could not create product in Prokip. Please check the product details.');
  }
}

/**
 * Record a sale in Prokip
 * @param {Object} saleData - Sale details
 * @returns {Promise<Object>} - Sale response
 */
async function recordSale(saleData, userId = null) {
  try {
    const headers = await getAuthHeaders(userId);
    const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : await prisma.prokipConfig.findUnique({ where: { id: 1 } });
    
    const sellBody = {
      sells: [{
        location_id: parseInt(saleData.locationId || config?.locationId),
        contact_id: saleData.contactId || 1,
        transaction_date: saleData.transactionDate || new Date().toISOString().slice(0, 19).replace('T', ' '),
        invoice_no: saleData.invoiceNo,
        status: 'final',
        type: 'sell',
        payment_status: 'paid',
        final_total: parseFloat(saleData.total),
        discount_amount: parseFloat(saleData.discount || 0),
        discount_type: 'fixed',
        products: saleData.products,
        payments: [{
          method: saleData.paymentMethod || 'cash',
          amount: parseFloat(saleData.total),
          paid_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
        }]
      }]
    };

    const response = await axios.post(
      `${process.env.PROKIP_API}/connector/api/sell`,
      sellBody,
      { headers }
    );
    
    return response.data;
  } catch (error) {
    console.error('Failed to record sale in Prokip:', error.response?.data || error.message);
    throw new Error('Could not record sale in Prokip. Please try again.');
  }
}

/**
 * Process sell return/refund in Prokip
 * @param {Object} returnData - Return details
 * @returns {Promise<Object>} - Return response
 */
async function processSellReturn(returnData, userId = null) {
  try {
    const headers = await getAuthHeaders(userId);
    
    const returnBody = {
      transaction_id: returnData.transactionId,
      transaction_date: returnData.transactionDate || new Date().toISOString(),
      products: returnData.products,
      discount_amount: parseFloat(returnData.discount || 0),
      discount_type: 'fixed'
    };

    const response = await axios.post(
      `${process.env.PROKIP_API}/connector/api/sell-return`,
      returnBody,
      { headers }
    );
    
    return response.data;
  } catch (error) {
    console.error('Failed to process return in Prokip:', error.response?.data || error.message);
    throw new Error('Could not process return in Prokip. Please try again.');
  }
}

/**
 * Record a purchase in Prokip
 * @param {Object} purchaseData - Purchase details
 * @returns {Promise<Object>} - Purchase response
 */
async function recordPurchase(purchaseData, userId = null) {
  try {
    const headers = await getAuthHeaders(userId);
    const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : await prisma.prokipConfig.findUnique({ where: { id: 1 } });
    
    const purchaseBody = {
      location_id: purchaseData.locationId || config?.locationId,
      supplier_id: purchaseData.supplierId || 'default',
      transaction_date: purchaseData.transactionDate || new Date().toISOString(),
      reference_no: purchaseData.referenceNo,
      items: purchaseData.items
    };

    const response = await axios.post(
      `${process.env.PROKIP_API}/connector/api/purchase`,
      purchaseBody,
      { headers }
    );
    
    return response.data;
  } catch (error) {
    console.error('Failed to record purchase in Prokip:', error.response?.data || error.message);
    throw new Error('Could not record purchase in Prokip. Please try again.');
  }
}

/**
 * Update product stock in Prokip
 * @param {string} productId - Prokip product ID
 * @param {number} quantity - New quantity
 * @param {number} locationId - Location ID
 * @returns {Promise<Object>} - Update response
 */
async function updateProductStock(productId, quantity, locationId = null, userId = null) {
  try {
    const headers = await getAuthHeaders(userId);
    const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : await prisma.prokipConfig.findUnique({ where: { id: 1 } });
    
    const response = await axios.put(
      `${process.env.PROKIP_API}/connector/api/product/${productId}`,
      {
        product_id: productId,
        quantity: quantity,
        location_id: locationId || config?.locationId
      },
      { headers }
    );
    
    return response.data;
  } catch (error) {
    console.error('Failed to update stock in Prokip:', error.response?.data || error.message);
    throw new Error('Could not update stock in Prokip. Please try again.');
  }
}

/**
 * Get Prokip config from database
 * @returns {Promise<Object|null>} - Prokip config or null
 */
async function getProkipConfig() {
  return await prisma.prokipConfig.findUnique({ where: { id: 1 } });
}

/**
 * Get sales/transactions from Prokip
 * @param {number} locationId - Business location ID (optional)
 * @param {string} startDate - Start date for filtering (optional)
 * @param {string} endDate - End date for filtering (optional)
 * @returns {Promise<Array>} - List of sales
 */
async function getSales(locationId = null, startDate = null, endDate = null, userId = null) {
  try {
    const headers = await getAuthHeaders(userId);
    const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : await prisma.prokipConfig.findUnique({ where: { id: 1 } });
    const locId = locationId || config?.locationId;
    
    let url = `${process.env.PROKIP_API}/connector/api/sell?per_page=-1`;
    if (locId) {
      url += `&location_id=${locId}`;
    }
    if (startDate) {
      url += `&start_date=${startDate}`;
    }
    if (endDate) {
      url += `&end_date=${endDate}`;
    }

    const response = await axios.get(url, { headers });
    return response.data.data || [];
  } catch (error) {
    console.error('Failed to fetch Prokip sales:', error.response?.data || error.message);
    throw new Error('Could not load sales from Prokip. Please check your connection.');
  }
}

/**
 * Get purchases from Prokip
 * @param {number} locationId - Business location ID (optional)
 * @param {string} startDate - Start date for filtering (optional)
 * @param {string} endDate - End date for filtering (optional)
 * @returns {Promise<Array>} - List of purchases
 */
async function getPurchases(locationId = null, startDate = null, endDate = null, userId = null) {
  try {
    const headers = await getAuthHeaders(userId);
    const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : await prisma.prokipConfig.findUnique({ where: { id: 1 } });
    const locId = locationId || config?.locationId;
    
    // Try different possible endpoints for purchases
    let url = `${process.env.PROKIP_API}/connector/api/purchase?per_page=-1`;
    
    try {
      console.log('🔍 Trying purchases endpoint:', url);
      const response = await axios.get(url, { headers });
      return response.data.data || [];
    } catch (purchaseError) {
      console.log('❌ Purchase endpoint failed, trying alternatives...');
      
      // Try common alternatives
      const alternatives = [
        `${process.env.PROKIP_API}/connector/api/purchases?per_page=-1`,
        `${process.env.PROKIP_API}/connector/api/expense?per_page=-1`,
        `${process.env.PROKIP_API}/connector/api/expenses?per_page=-1`
      ];
      
      for (const altUrl of alternatives) {
        try {
          console.log('🔍 Trying alternative:', altUrl);
          const altResponse = await axios.get(altUrl, { headers });
          console.log('✅ Alternative endpoint worked:', altUrl);
          return altResponse.data.data || [];
        } catch (altError) {
          console.log('❌ Alternative failed:', altUrl);
          continue;
        }
      }
      
      // If all alternatives fail, return empty array instead of throwing error
      console.log('⚠️ No purchases endpoint found, returning empty array');
      return [];
    }
  } catch (error) {
    console.error('Failed to fetch Prokip purchases:', error.response?.data || error.message);
    // Return empty array instead of throwing error to prevent breaking the UI
    return [];
  }
}

/**
 * Check if user is authenticated with Prokip
 * @param {number} userId - User ID
 * @returns {Promise<boolean>}
 */
async function isAuthenticated(userId = null) {
  const token = await getValidToken(userId);
  return !!token;
}

/**
 * Clear Prokip authentication
 */
async function clearAuthentication() {
  try {
    await prisma.prokipConfig.delete({ where: { id: 1 } });
  } catch (error) {
    // Ignore if config doesn't exist
  }
}

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
  clearAuthentication
};
