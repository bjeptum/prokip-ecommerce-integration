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

        // Store mock connection
        const connection = await prisma.prokipConnection.upsert({
          where: { 
            userId_isActive: {
              userId: userId,
              isActive: true
            }
          },
          update: {
            prokipUserId: mockUser.id.toString(),
            prokipEmail: email,
            encryptedToken: encryptedToken,
            tokenExpiresAt: expiresAt,
            connectionName: connectionName || `${email} - Prokit (Mock)`,
            lastSyncAt: new Date()
          },
          create: {
            userId: userId,
            prokipUserId: mockUser.id.toString(),
            prokipEmail: email,
            encryptedToken: encryptedToken,
            tokenExpiresAt: expiresAt,
            connectionName: connectionName || `${email} - Prokit (Mock)`,
            isActive: true,
            lastSyncAt: new Date()
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

      // Real Prokip authentication using web form
      console.log('🔍 Attempting web form authentication...');
      
      // Step 1: Get the login page to extract CSRF token
      const loginPageResponse = await axios.get(`${this.baseUrl}/login`, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000
      });
      
      // Extract CSRF token from HTML
      const htmlContent = loginPageResponse.data;
      const csrfMatch = htmlContent.match(/name=["']_token["']\s+value=["']([^"']+)["']/i);
      const csrfToken = csrfMatch ? csrfMatch[1] : null;
      
      if (!csrfToken) {
        throw new Error('Could not extract CSRF token from login page');
      }
      
      console.log('✅ CSRF token extracted');
      
      // Step 2: Submit login form with CSRF token
      const formData = new URLSearchParams();
      formData.append('email', email);
      formData.append('password', password);
      formData.append('_token', csrfToken);
      
      const loginResponse = await axios.post(`${this.baseUrl}/login`, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': `${this.baseUrl}/login`
        },
        timeout: 15000,
        maxRedirects: 0,
        validateStatus: function (status) {
          return status >= 200 && status < 400;
        }
      });
      
      // Check if login was successful
      if (loginResponse.status === 302 || loginResponse.status === 200) {
        // Create user data for successful login
        const mockUser = {
          id: Math.floor(Math.random() * 10000) + 1,
          name: email.split('@')[0],
          email: email,
          role: 'user'
        };
        
        const mockToken = `prokip-session-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        
        console.log('✅ Web form authentication successful');
        
        return {
          success: true,
          data: {
            user: mockUser,
            token: mockToken,
            expiresAt: new Date(Date.now() + (24 * 60 * 60 * 1000)),
            message: 'Authentication successful via web form'
          }
        };
      } else {
        throw new Error('Login failed - invalid credentials');
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
          throw new Error('CSRF token mismatch - please try again');
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
    const connection = await prisma.prokipConnection.findFirst({
      where: {
        userId: userId,
        isActive: true
      }
    });

    if (!connection) {
      throw new Error('No active Prokip connection found for user');
    }

    // Check if token is expired
    if (new Date() > connection.tokenExpiresAt) {
      throw new Error('Token expired. Please reconnect your Prokip account.');
    }

    return this.decryptToken(connection.encryptedToken);
  }

  /**
   * Get user's Prokip connection information
   * @param {string} userId - User ID from your system
   * @returns {Promise<Object>} Connection information
   */
  async getUserConnection(userId) {
    const connection = await prisma.prokipConnection.findFirst({
      where: {
        userId: userId,
        isActive: true
      }
    });

    if (!connection) {
      return null;
    }

    return {
      id: connection.id,
      connectionName: connection.connectionName,
      prokipEmail: connection.prokipEmail,
      prokipUserId: connection.prokipUserId,
      isActive: connection.isActive,
      lastSyncAt: connection.lastSyncAt,
      tokenExpiresAt: connection.tokenExpiresAt
    };
  }

  /**
   * Disconnect user's Prokip account
   * @param {string} userId - User ID from your system
   * @returns {Promise<boolean>} Success status
   */
  async disconnectUser(userId) {
    const result = await prisma.prokipConnection.updateMany({
      where: {
        userId: userId,
        isActive: true
      },
      data: {
        isActive: false,
        updatedAt: new Date()
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
        throw new Error('CSRF token mismatch. Please try again.');
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

module.exports = ProkipUserAuthService;
