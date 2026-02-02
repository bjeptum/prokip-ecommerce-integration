const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const crypto = require('crypto');

const prisma = new PrismaClient();

class ProkipUserAuthService {
  constructor() {
    this.baseUrl = process.env.PROKIP_BASE_URL;
    if (!this.baseUrl) {
      throw new Error('PROKIP_BASE_URL environment variable is required');
    }
  }

  /**
   * Authenticate user with Prokip using web form authentication
   * @param {string} userId - User ID from your system
   * @param {string} email - Prokip login email
   * @param {string} password - Prokip login password
   * @param {string} connectionName - Optional name for the connection
   * @returns {Promise<Object>} Authentication result with connection info
   */
  async authenticateUser(userId, email, password, connectionName = null) {
    try {
      console.log(`🔐 Authenticating user ${userId} with Prokip...`);

      // Check if we're in mock mode
      if (process.env.MOCK_PROKIP === 'true') {
        console.log('🧪 Using mock authentication mode');
        
        // Mock authentication for testing
        const mockUser = {
          id: Math.floor(Math.random() * 10000) + 1,
          name: email.split('@')[0],
          email: email,
          role: 'user'
        };
        
        const mockToken = `mock-jwt-token-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        
        const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000));
        const encryptedToken = this.encryptToken(mockToken);

        // Store mock connection using ProkipConfig
        const connection = await prisma.prokipConfig.upsert({
          where: { userId: userId },
          update: {
            token: mockToken,
            refreshToken: null,
            expiresAt: expiresAt,
            apiUrl: this.baseUrl,
            locationId: '1' // Default location for mock
          },
          create: {
            userId: userId,
            token: mockToken,
            refreshToken: null,
            expiresAt: expiresAt,
            apiUrl: this.baseUrl,
            locationId: '1' // Default location for mock
          }
        });

        return {
          success: true,
          data: {
            connectionId: connection.id,
            user: mockUser,
            token: mockToken,
            expiresAt: expiresAt,
            message: 'Authentication successful (mock mode)'
          }
        };
      }

      // Real Prokip web authentication
      console.log('🔍 Attempting web authentication...');
      console.log('📝 Identifier received:', email);
      console.log('📝 Identifier type (looks like email?):', email.includes('@'));
      
      // First, get the login page to obtain CSRF token
      const loginPageResponse = await axios.get(`${this.baseUrl}/login`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      
      // Extract cookies from login page
      const cookies = loginPageResponse.headers['set-cookie'] || [];
      const cookieString = cookies.map(cookie => cookie.split(';')[0]).join('; ');
      console.log('🍪 Cookies extracted:', cookieString);
      
      // Extract CSRF token from the login page
      const csrfTokenMatch = loginPageResponse.data.match(/name="csrf-token" content="([^"]+)"/);
      if (!csrfTokenMatch) {
        throw new Error('Could not obtain CSRF token from Prokip login page');
      }
      
      const csrfToken = csrfTokenMatch[1];
      console.log('🔐 Obtained CSRF token:', csrfToken.substring(0, 20) + '...');
      
      // Prepare form data for web login
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);
      formData.append('_token', csrfToken);
      
      console.log('📝 Form data prepared:');
      console.log('  - username:', email);
      console.log('  - password: [provided]');
      console.log('  - _token:', csrfToken.substring(0, 20) + '...');
      
      // Perform web login
      console.log('🌐 Sending login request to:', `${this.baseUrl}/login`);
      
      const loginResponse = await axios.post(`${this.baseUrl}/login`, formData, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': this.baseUrl,
          'Referer': `${this.baseUrl}/login`,
          'Cookie': cookieString,
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        maxRedirects: 0, // Don't follow redirects automatically
        validateStatus: function (status) {
          return status >= 200 && status < 400; // Accept 2xx and 3xx responses
        }
      });
      
      console.log('📊 Login response status:', loginResponse.status);
      console.log('📊 Login response headers:', JSON.stringify(loginResponse.headers, null, 2));
      
      if (loginResponse.status >= 400) {
        console.log('❌ Login failed with status:', loginResponse.status);
        console.log('📊 Response data:', loginResponse.data);
        throw new Error(`Login failed with status ${loginResponse.status}`);
      }
      
      // Check if login was successful by looking for redirect
      if (loginResponse.status === 302 || loginResponse.status === 307) {
        const location = loginResponse.headers.location;
        console.log('🔄 Redirected to:', location);
        
        // If redirected back to login, it failed
        if (location.includes('/login')) {
          throw new Error('Invalid credentials - redirected back to login');
        }
        
        // If redirected elsewhere (dashboard/home), it succeeded
        console.log('✅ Web authentication successful');
        
        // Extract session cookies from the response
        const responseCookies = loginResponse.headers['set-cookie'] || [];
        const sessionCookie = responseCookies.find(cookie => cookie.startsWith('_session=')) || 
                              responseCookies.find(cookie => cookie.startsWith('laravel_session='));
        
        console.log('🍪 Response cookies found:', responseCookies.length);
        console.log('🍪 Session cookie:', sessionCookie ? sessionCookie.substring(0, 100) + '...' : 'none');
        
        if (!sessionCookie) {
          console.log('⚠️ No session cookie found, but login appears successful');
        }
        
        // Extract session token from cookie
        const sessionToken = sessionCookie ? sessionCookie.split(';')[0].replace(/^(laravel_)?_session=/, '') : 'session-established';
        
        // Get user info using the session
        let user = null;
        try {
          const userResponse = await axios.get(`${this.baseUrl}/connector/api/user/loggedin`, {
            headers: {
              'Cookie': sessionCookie || cookieString,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (userResponse.data && userResponse.data.data) {
            user = userResponse.data.data;
            console.log('✅ User info retrieved:', user.email);
          }
        } catch (userError) {
          console.log('⚠️ Could not retrieve user info, creating mock user');
          // Create a mock user if we can't get the real one
          user = {
            id: Math.floor(Math.random() * 10000) + 1,
            name: email.split('@')[0],
            email: email,
            username: email
          };
        }
        
        // Create a session-based token for our system
        const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours
        const encryptedToken = this.encryptToken(sessionToken);
        
        // Store or update user's Prokip connection using ProkipConfig
        const connection = await prisma.prokipConfig.upsert({
          where: { userId: userId },
          update: {
            token: sessionCookie || cookieString, // Store full cookie for API calls
            refreshToken: null,
            expiresAt: expiresAt,
            apiUrl: this.baseUrl,
            locationId: '1' // Default location - should be updated by user later
          },
          create: {
            userId: userId,
            token: sessionCookie || cookieString, // Store full cookie for API calls
            refreshToken: null,
            expiresAt: expiresAt,
            apiUrl: this.baseUrl,
            locationId: '1' // Default location - should be updated by user later
          }
        });

        return {
          success: true,
          data: {
            connectionId: connection.id,
            user: user,
            token: sessionCookie || cookieString, // Return full cookie for API calls
            expiresAt: expiresAt,
            tokenType: 'session',
            message: 'Authentication successful via web login'
          }
        };
        
      } else {
        throw new Error('Login failed - invalid credentials or login page changed');
      }

    } catch (error) {
      console.error(`❌ Authentication failed for user ${userId}:`, error.message);
      
      // Handle different error types
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 401) {
          throw new Error('Invalid email or password');
        } else if (status === 422) {
          throw new Error('Invalid credentials format');
        } else if (status === 419) {
          throw new Error('Invalid email or password');
        } else if (status === 404) {
          throw new Error('Prokip API endpoint not found. Please check configuration.');
        } else {
          throw new Error(data?.message || `Authentication failed (${status})`);
        }
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error('Cannot connect to Prokip API. Please check your internet connection.');
      } else {
        throw new Error('Authentication failed: ' + error.message);
      }
    }
  }

  /**
   * Encrypt token for secure storage
   * @param {string} token - JWT token to encrypt
   * @returns {string} Encrypted token
   */
  encryptToken(token) {
    const algorithm = 'aes-256-gcm';
    const secretKey = process.env.ENCRYPTION_SECRET || 'default-secret-key-change-in-production';
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, secretKey);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt token from storage
   * @param {string} encryptedToken - Encrypted token
   * @returns {string} Decrypted token
   */
  decryptToken(encryptedToken) {
    const algorithm = 'aes-256-gcm';
    const secretKey = process.env.ENCRYPTION_SECRET || 'default-secret-key-change-in-production';
    
    const parts = encryptedToken.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipher(algorithm, secretKey);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Get valid JWT token for user, refresh if needed
   * @param {string} userId - User ID from your system
   * @returns {Promise<string>} Valid JWT token
   */
  async getUserToken(userId) {
    const connection = await prisma.prokipConfig.findFirst({
      where: {
        userId: userId
      }
    });
    
    if (!connection) {
      throw new Error('No Prokip connection found for user');
    }
    
    return connection.token;
  }

  /**
   * Get user's Prokip connection information
   * @param {string} userId - User ID from your system
   * @returns {Promise<Object>} Connection information
   */
  async getUserConnection(userId) {
    const connection = await prisma.prokipConfig.findFirst({
      where: {
        userId: userId
      }
    });
    
    if (!connection) {
      throw new Error('No Prokip connection found for user');
    }
    
    return {
      id: connection.id,
      userId: connection.userId,
      token: connection.token,
      locationId: connection.locationId,
      expiresAt: connection.expiresAt,
      apiUrl: connection.apiUrl
    };
  }

  /**
   * Disconnect user's Prokip account
   * @param {string} userId - User ID from your system
   * @returns {Promise<boolean>} Success status
   */
  async disconnectUser(userId) {
    const result = await prisma.prokipConfig.deleteMany({
      where: {
        userId: userId
      }
    });
    
    return result.count > 0;
  }

  /**
   * Get user's Prokip customer ID
   * @param {string} userId - User ID from your system
   * @returns {Promise<string>} Prokip customer ID
   */
  async getUserProkipCustomerId(userId) {
    const connection = await this.getUserConnection(userId);
    return connection ? connection.prokipUserId : null;
  }

  /**
   * Get business locations for authenticated user
   * @param {string} token - Full session cookie string
   * @returns {Promise<Array>} - List of business locations
   */
  async getBusinessLocations(token) {
    try {
      console.log('📍 Fetching business locations from Prokip API...');
      
      const response = await axios.get(`${this.baseUrl}/connector/api/business-location`, {
        headers: {
          'Cookie': token, // Use full cookie string
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        timeout: 60000
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
      
      // Always throw error - no mock data allowed
      throw new Error('Could not load your business locations. Please try again.');
    }
  }

  /**
   * Make authenticated API call to Prokip on behalf of user
   * @param {string} userId - User ID from your system
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @param {string} method - HTTP method
   * @returns {Promise<Object>} API response
   */
  async makeAuthenticatedCall(userId, endpoint, data = null, method = 'POST') {
    try {
      // Check if we're in mock mode
      if (process.env.MOCK_PROKIP === 'true') {
        console.log('🧪 Using mock API call for endpoint:', endpoint);
        
        // Mock different endpoints
        if (endpoint.includes('/stock/check')) {
          return {
            success: true,
            allAvailable: true,
            stockChecks: data?.items?.map(item => ({
              sku: item.sku,
              requestedQuantity: item.quantity,
              currentStock: Math.floor(Math.random() * 100) + 10,
              available: true
            })) || []
          };
        }
        
        if (endpoint.includes('/orders')) {
          return {
            success: true,
            transactionId: `mock-tx-${Date.now()}`,
            receiptNumber: `mock-receipt-${Date.now()}`,
            message: 'Order processed successfully (mock)'
          };
        }
        
        // Default mock response
        return {
          success: true,
          message: 'Mock API call successful',
          data: data
        };
      }

      const token = await this.getUserToken(userId);
      
      const config = {
        method: method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 15000
      };

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;

    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Authentication expired. Please reconnect your Prokip account.');
      } else if (error.response?.status === 419) {
        throw new Error('Invalid email or password');
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error('Cannot connect to Prokip API. Please check your internet connection.');
      } else {
        throw new Error(`API call failed: ${error.message}`);
      }
    }
  }

  /**
   * Check stock availability for items
   * @param {string} userId - User ID from your system
   * @param {Array} items - Array of items to check
   * @returns {Promise<Object>} Stock availability result
   */
  async checkStockAvailability(userId, items) {
    try {
      const response = await this.makeAuthenticatedCall(userId, '/api/v1/stock/check', {
        items: items
      });
      
      return response;
    } catch (error) {
      console.error('❌ Stock check failed:', error.message);
      throw error;
    }
  }
}

module.exports = {
  ProkipUserAuthService
};
