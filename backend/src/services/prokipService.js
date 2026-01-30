const axios = require('axios');
const prisma = require('../lib/prisma');

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
      timeout: 60000 // 60 second timeout
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
  console.log('  - locationId:', locationId);
  
  try {
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
  } catch (error) {
    console.error('❌ saveProkipConfig failed:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      meta: error.meta
    });
    
    // Log additional context
    console.error('Config context:', {
      userId,
      locationId,
      hasAccessToken: !!access_token,
      accessTokenLength: access_token?.length,
      expires_in
    });
    
    throw error; // Re-throw to be handled by the calling function
  }
}

/**
 * Get valid access token, refreshing if necessary
 * @returns {Promise<string|null>} - Valid access token or null
 */
async function getValidToken(userId = null) {
  console.log(`🔐 getValidToken called with userId: ${userId} (type: ${typeof userId})`);
  console.trace('🔐 Call stack:');
  
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
      timeout: 60000 // Increased timeout to 60 seconds
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
    
    if (error.code === 'ECONNABORTED') {
      throw new Error('Connection timeout. Please check your internet connection and try again.');
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
    
    // Check if token is expired and refresh if needed
    const isAuthenticatedStatus = await isAuthenticated(userId);
    if (!isAuthenticatedStatus) {
      console.warn('⚠️ Token is invalid or expired for user:', userId);
      throw new Error('Session expired. Please log in again.');
    }
    
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

    // Add retry logic for connection issues
    let response;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        response = await axios.get(url, { 
          headers, 
          timeout: 15000,
          // Add connection keep-alive for better reliability
          family: 4 // Force IPv4
        });
        break; // Success, exit retry loop
      } catch (error) {
        retryCount++;
        console.warn(`🔄 Retry ${retryCount}/${maxRetries} for Prokip API:`, error.message);
        
        if (retryCount >= maxRetries) {
          throw error; // Re-throw the last error
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
    
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
    
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      throw new Error('Could not connect to Prokip API. Please check your internet connection and try again.');
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
 * @param {number} userId - User ID (optional, defaults to first record)
 * @returns {Promise<Object|null>} - Prokip config or null
 */
async function getProkipConfig(userId = null) {
  if (userId) {
    return await prisma.prokipConfig.findFirst({ where: { userId } });
  } else {
    return await prisma.prokipConfig.findFirst();
  }
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
    console.error('❌ Failed to fetch Prokip sales:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      meta: error.meta
    });
    
    // Log additional context
    console.error('Sales context:', {
      userId,
      locationId,
      hasAccessToken: !!access_token,
      accessTokenLength: access_token?.length,
      expires_in
    });
    
    throw error; // Re-throw to be handled by the calling function
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
 * Clear Prokip authentication for a specific user
 * @param {number} userId - User ID (optional, defaults to clearing all)
 */
async function clearAuthentication(userId = null) {
  try {
    if (userId) {
      // Clear specific user's config
      await prisma.prokipConfig.deleteMany({ where: { userId } });
      console.log(`✅ Cleared Prokip authentication for user ${userId}`);
    } else {
      // Clear all configs (fallback)
      await prisma.prokipConfig.deleteMany({});
      console.log('✅ Cleared all Prokip authentication');
    }
  } catch (error) {
    console.log('⚠️ No Prokip config to clear or clear failed:', error.message);
  }
}

/**
 * Save opening stock to Prokip
 * @param {Array} stockData - Array of stock items with product_id, quantity, location_id
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Response from Prokip API
 */
async function saveOpeningStock(stockData, userId = null) {
  try {
    const headers = await getAuthHeaders(userId);
    const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : await prisma.prokipConfig.findUnique({ where: { id: 1 } });
    
    const payload = {
      opening_stock: stockData.map(item => ({
        product_id: item.productId || item.product_id,
        quantity: parseInt(item.quantity || 0),
        location_id: item.locationId || config?.locationId,
        unit_cost: parseFloat(item.unitCost || 0),
        lot_number: item.lotNumber || null,
        expiry_date: item.expiryDate || null
      }))
    };

    const response = await axios.post(
      `${process.env.PROKIP_API}/connector/api/opening-stock/save`,
      payload,
      { headers }
    );
    
    console.log('✅ Opening stock saved to Prokip successfully');
    return response.data;
  } catch (error) {
    console.error('Failed to save opening stock to Prokip:', error.response?.data || error.message);
    throw new Error('Could not save opening stock to Prokip. Please check the stock data.');
  }
}

/**
 * Get opening stock from Prokip
 * @param {number} locationId - Business location ID (optional)
 * @param {number} userId - User ID
 * @returns {Promise<Array>} - Opening stock data
 */
async function getOpeningStock(locationId = null, userId = null) {
  try {
    const headers = await getAuthHeaders(userId);
    const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : await prisma.prokipConfig.findUnique({ where: { id: 1 } });
    const locId = locationId || config?.locationId;
    
    let url = `${process.env.PROKIP_API}/connector/api/opening-stock`;
    if (locId) {
      url += `?location_id=${locId}`;
    }

    const response = await axios.get(url, { headers });
    return response.data.data || response.data || [];
  } catch (error) {
    console.error('Failed to fetch opening stock from Prokip:', error.response?.data || error.message);
    throw new Error('Could not fetch opening stock from Prokip. Please check your connection.');
  }
}

/**
 * Create stock adjustment in Prokip
 * @param {Object} adjustmentData - Stock adjustment details
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Adjustment response
 */
/**
 * Working Stock Adjustment Function for Prokip
 * Uses /stock-adjustments endpoint with proper CSRF handling
 */
async function adjustStockInProkip(sku, quantity, userId = null) {
  try {
    const headers = await getAuthHeaders(userId);
    const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : await prisma.prokipConfig.findUnique({ where: { id: 1 } });
    
    // Try multiple payload formats for stock adjustment
    const payloadFormats = [
      // Format 1: Full stock adjustment
      {
        location_id: config?.locationId || 21237,
        adjustment_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        reason: 'WooCommerce sale stock reduction',
        final_total: 0,
        products: [{
          product_id: parseInt(sku),
          quantity: -quantity, // Negative to reduce stock
          unit_price: 0,
          unit_price_inc_tax: 0
        }]
      },
      
      // Format 2: Simplified adjustment
      {
        location_id: config?.locationId || 21237,
        product_id: parseInt(sku),
        quantity: -quantity,
        adjustment_type: 'sale',
        reason: 'WooCommerce order'
      },
      
      // Format 3: Transaction format
      {
        type: 'stock_adjustment',
        location_id: config?.locationId || 21237,
        transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        notes: 'Stock reduction from WooCommerce sale',
        products: [{
          product_id: parseInt(sku),
          quantity: -quantity,
          unit_price: 0
        }]
      }
    ];

    const endpoints = [
      '/stock-adjustments',
      '/api/stock-adjustments',
      '/connector/api/stock-adjustments'
    ];

    for (const endpoint of endpoints) {
      for (let i = 0; i < payloadFormats.length; i++) {
        try {
          const response = await axios.post(
            `https://api.prokip.africa${endpoint}`,
            payloadFormats[i],
            { 
              headers: { 
                ...headers, 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              }, 
              timeout: 15000 
            }
          );
          
          console.log(`✓ Stock adjusted in Prokip for SKU ${sku}: ${quantity} units via ${endpoint} (Format ${i + 1})`);
          return { success: true, endpoint, format: i + 1, data: response.data };
          
        } catch (error) {
          // Log but continue trying
          if (error.response?.status !== 404 && error.response?.status !== 422) {
            console.log(`⚠️  ${endpoint} Format ${i + 1}: ${error.response?.status || 'ERROR'}`);
          }
        }
      }
    }
    
    // If all stock adjustments fail, try opening-stock approach
    console.log(`⚠️  Stock adjustment failed for SKU ${sku}, trying opening-stock approach...`);
    return await setStockInProkip(sku, null, quantity, userId);
    
  } catch (error) {
    console.error(`❌ Failed to adjust stock for SKU ${sku}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Working Stock Setting Function for Prokip
 * Uses opening-stock endpoint to set exact stock levels
 */
async function setStockInProkip(sku, targetQuantity = null, reduceBy = null, userId = null) {
  try {
    const headers = await getAuthHeaders(userId);
    const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : await prisma.prokipConfig.findUnique({ where: { id: 1 } });
    
    // Get current stock first
    const currentStock = await getInventory(null, userId);
    const stockItem = currentStock.find(item => item.sku === sku);
    
    if (!stockItem) {
      throw new Error(`Product SKU ${sku} not found in inventory`);
    }
    
    const currentQuantity = parseInt(stockItem.stock);
    let newQuantity;
    
    if (targetQuantity !== null) {
      newQuantity = targetQuantity;
    } else if (reduceBy !== null) {
      newQuantity = Math.max(0, currentQuantity - reduceBy);
    } else {
      throw new Error('Either targetQuantity or reduceBy must be provided');
    }
    
    const payload = {
      location_id: config?.locationId || 21237,
      opening_stock_date: new Date().toISOString().slice(0, 10),
      products: [{
        product_id: parseInt(sku),
        quantity: newQuantity
      }]
    };
    
    const endpoints = [
      '/opening-stock',
      '/api/opening-stock',
      '/connector/api/opening-stock'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await axios.post(
          `https://api.prokip.africa${endpoint}`,
          payload,
          { 
            headers: { 
              ...headers, 
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
            }, 
            timeout: 15000 
          }
        );
        
        console.log(`✓ Stock set in Prokip for SKU ${sku}: ${currentQuantity} → ${newQuantity} via ${endpoint}`);
        return { success: true, endpoint, oldStock: currentQuantity, newStock: newQuantity, response: response.data };
        
      } catch (error) {
        if (error.response?.status !== 404) {
          console.log(`⚠️  ${endpoint}: ${error.response?.status || 'ERROR'}`);
        }
      }
    }
    
    throw new Error('All opening-stock endpoints failed');
    
  } catch (error) {
    console.error(`❌ Failed to set stock for SKU ${sku}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Create stock adjustment in Prokip
 * @param {Object} adjustmentData - Stock adjustment details
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Adjustment response
 */
async function createStockAdjustment(adjustmentData, userId = null) {
  try {
    const headers = await getAuthHeaders(userId);
    const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : await prisma.prokipConfig.findUnique({ where: { id: 1 } });
    
    const payload = {
      location_id: adjustmentData.locationId || config?.locationId,
      adjustment_date: adjustmentData.adjustmentDate || new Date().toISOString().slice(0, 19).replace('T', ' '),
      reason: adjustmentData.reason || 'Manual adjustment',
      final_total: parseFloat(adjustmentData.totalAmount || 0),
      products: adjustmentData.products.map(item => ({
        product_id: item.productId || item.product_id,
        quantity: parseInt(item.quantity || 0),
        unit_price: parseFloat(item.unitPrice || 0),
        adjustment_type: item.adjustmentType || 'subtract', // 'add' or 'subtract'
        lot_number: item.lotNumber || null,
        expiry_date: item.expiryDate || null
      }))
    };

    console.log('🔧 Creating stock adjustment with payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(
      `${process.env.PROKIP_API}/connector/api/stock-adjustments`,
      payload,
      { headers }
    );
    
    console.log('✅ Stock adjustment created in Prokip successfully');
    return response.data;
  } catch (error) {
    console.error('Failed to create stock adjustment in Prokip:', error.response?.data || error.message);
    console.error('Full error:', error);
    throw new Error('Could not create stock adjustment in Prokip. Please check the adjustment data.');
  }
}

/**
 * Get stock adjustments from Prokip
 * @param {number} locationId - Business location ID (optional)
 * @param {string} startDate - Start date for filtering (optional)
 * @param {string} endDate - End date for filtering (optional)
 * @param {number} userId - User ID
 * @returns {Promise<Array>} - Stock adjustments data
 */
async function getStockAdjustments(locationId = null, startDate = null, endDate = null, userId = null) {
  try {
    const headers = await getAuthHeaders(userId);
    const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : await prisma.prokipConfig.findUnique({ where: { id: 1 } });
    const locId = locationId || config?.locationId;
    
    let url = `${process.env.PROKIP_API}/connector/api/stock-adjustments`;
    const params = new URLSearchParams();
    
    if (locId) params.append('location_id', locId);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await axios.get(url, { headers });
    return response.data.data || response.data || [];
  } catch (error) {
    console.error('Failed to fetch stock adjustments from Prokip:', error.response?.data || error.message);
    throw new Error('Could not fetch stock adjustments from Prokip. Please check your connection.');
  }
}

/**
 * Deduct stock from Prokip after WooCommerce sale
 * @param {Array} products - Array of products with product_id, quantity
 * @param {number} locationId - Location ID (optional)
 * @param {string} reason - Reason for deduction (optional)
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Deduction response
 */
async function deductStockFromProkip(products, locationId = null, reason = 'WooCommerce sale', userId = null) {
  try {
    const headers = await getAuthHeaders(userId);
    const config = userId ? await prisma.prokipConfig.findFirst({ where: { userId } }) : await prisma.prokipConfig.findUnique({ where: { id: 1 } });
    
    // Add CSRF protection headers for Prokip API
    const enhancedHeaders = {
      ...headers,
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    const adjustmentData = {
      locationId: locationId || config?.locationId,
      adjustmentDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
      reason: reason,
      totalAmount: 0, // Stock adjustments typically don't have monetary value
      products: products.map(item => ({
        productId: item.productId || item.product_id,
        product_id: item.productId || item.product_id,
        quantity: parseInt(item.quantity || 0),
        adjustmentType: 'subtract', // Always subtract for sales
        unitPrice: 0
      }))
    };

    console.log('🔧 Deducting stock with payload:', JSON.stringify(adjustmentData, null, 2));
    
    // Try multiple endpoints for stock deduction
    const endpoints = [
      `${process.env.PROKIP_API}/connector/api/stock-adjustments`,
      `${process.env.PROKIP_API}/connector/api/sell`, // Alternative: record as sale
      `${process.env.PROKIP_API}/connector/api/opening-stock/save` // Alternative: opening stock
    ];
    
    for (const endpoint of endpoints) {
      try {
        let payload = adjustmentData;
        
        // Adjust payload format for different endpoints
        if (endpoint.includes('/sell')) {
          payload = {
            location_id: parseInt(adjustmentData.locationId),
            contact_id: 1, // Default customer
            transaction_date: adjustmentData.adjustmentDate,
            invoice_no: `WOO-${Date.now()}`,
            status: 'final',
            type: 'sell',
            payment_status: 'paid',
            final_total: 0,
            discount_amount: 0,
            discount_type: 'fixed',
            sell_lines: adjustmentData.products.map(p => ({
              product_id: parseInt(p.productId),
              quantity: p.quantity,
              unit_price: 0,
              line_total: 0
            })),
            payments: [{
              method: 'cash',
              amount: 0,
              paid_on: adjustmentData.adjustmentDate
            }]
          };
        } else if (endpoint.includes('/opening-stock')) {
          payload = {
            opening_stock: adjustmentData.products.map(p => ({
              product_id: parseInt(p.productId),
              quantity: -p.quantity, // Negative for reduction
              location_id: parseInt(adjustmentData.locationId)
            }))
          };
        }
        
        const response = await axios.post(endpoint, payload, { 
          headers: enhancedHeaders,
          timeout: 15000 
        });
        
        console.log(`✓ Stock deducted via ${endpoint} for ${products.length} products`);
        return { success: true, endpoint, response: response.data };
        
      } catch (error) {
        console.log(`⚠️ Endpoint ${endpoint} failed:`, error.response?.status || error.message);
        // Continue to next endpoint
      }
    }
    
    throw new Error('All stock deduction endpoints failed');
    
  } catch (error) {
    console.error('Failed to deduct stock from Prokip:', error.response?.data || error.message);
    throw new Error('Could not deduct stock from Prokip. Please check the product data.');
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
  clearAuthentication,
  saveOpeningStock,
  getOpeningStock,
  createStockAdjustment,
  getStockAdjustments,
  adjustStockInProkip,
  setStockInProkip,
  deductStockFromProkip
};
