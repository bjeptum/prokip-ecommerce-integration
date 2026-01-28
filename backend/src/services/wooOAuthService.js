const axios = require('axios');
const crypto = require('crypto');
const { getWooBaseUrl } = require('./wooService');

/**
 * WooCommerce OAuth 1.0a Implementation
 * Allows users to connect with just their store URL
 */

class WooOAuthService {
  constructor() {
    // Note: This OAuth service is not used in current implementation
    // We use Consumer Key/Secret authentication instead
    this.callbackUrl = `http://localhost:${process.env.PORT || 3000}/connections/callback/woocommerce`;
  }

  /**
   * Generate OAuth 1.0a parameters
   */
  generateOAuthParams(httpMethod, url, token = null, tokenSecret = null, additionalParams = {}) {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(16).toString('hex');
    
    const oauthParams = {
      oauth_consumer_key: this.clientId,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_version: '1.0a',
      ...additionalParams
    };

    if (token) {
      oauthParams.oauth_token = token;
    }

    // Create signature base string
    const allParams = { ...oauthParams, ...additionalParams };
    const sortedParams = Object.keys(allParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
      .join('&');

    const signatureBaseString = [
      httpMethod.toUpperCase(),
      encodeURIComponent(url),
      encodeURIComponent(sortedParams)
    ].join('&');

    // Create signing key
    const signingKey = `${encodeURIComponent(this.clientSecret)}&${tokenSecret ? encodeURIComponent(tokenSecret) : ''}`;

    // Generate signature
    const signature = crypto
      .createHmac('sha1', signingKey)
      .update(signatureBaseString)
      .digest('base64');

    oauthParams.oauth_signature = signature;

    return oauthParams;
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(storeUrl, userId) {
    const baseUrl = getWooBaseUrl(storeUrl);
    const requestTokenUrl = `${baseUrl}/wp-json/wc/v3/oauth1/request`;
    
    // Generate state parameter for security
    const state = Buffer.from(JSON.stringify({ 
      userId, 
      storeUrl: storeUrl.trim(),
      timestamp: Date.now()
    })).toString('base64');

    const params = {
      oauth_callback: this.callbackUrl,
      state: state
    };

    const oauthParams = this.generateOAuthParams('POST', requestTokenUrl, null, null, params);
    
    // Build authorization URL with parameters
    const authUrl = `${requestTokenUrl}?${new URLSearchParams(oauthParams).toString()}`;
    
    return authUrl;
  }

  /**
   * Exchange request token for access token
   */
  async exchangeRequestToken(requestToken, requestTokenSecret, verifier, storeUrl) {
    const baseUrl = getWooBaseUrl(storeUrl);
    const accessTokenUrl = `${baseUrl}/wp-json/wc/v3/oauth1/access`;
    
    const params = {
      oauth_verifier: verifier,
      oauth_token: requestToken
    };

    const oauthParams = this.generateOAuthParams('POST', accessTokenUrl, requestToken, requestTokenSecret, params);
    
    try {
      const response = await axios.post(accessTokenUrl, null, {
        params: oauthParams,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      // Parse response data (it might be URL-encoded or JSON)
      let responseData;
      try {
        responseData = new URLSearchParams(response.data);
      } catch (parseError) {
        // If not URL-encoded, try JSON
        responseData = response.data;
      }
      
      const accessToken = responseData.get ? responseData.get('oauth_token') : responseData.oauth_token;
      const accessTokenSecret = responseData.get ? responseData.get('oauth_token_secret') : responseData.oauth_token_secret;
      
      if (!accessToken || !accessTokenSecret) {
        throw new Error('Invalid response from WooCommerce: missing tokens');
      }
      
      return {
        accessToken,
        accessTokenSecret
      };
    } catch (error) {
      console.error('Failed to exchange request token:', error.response?.data || error.message);
      throw new Error('Failed to obtain access token from WooCommerce');
    }
  }

  /**
   * Validate access token by making a test API call
   */
  async validateAccessToken(storeUrl, accessToken, accessTokenSecret) {
    const baseUrl = getWooBaseUrl(storeUrl);
    const testUrl = `${baseUrl}/wp-json/wc/v3/system_status`;
    
    const oauthParams = this.generateOAuthParams('GET', testUrl, accessToken, accessTokenSecret);
    
    try {
      const response = await axios.get(testUrl, {
        params: oauthParams,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      return response.status === 200;
    } catch (error) {
      console.error('Access token validation failed:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Create authenticated API client
   */
  createAuthenticatedClient(storeUrl, accessToken, accessTokenSecret) {
    const baseUrl = getWooBaseUrl(storeUrl);
    
    return {
      get: async (endpoint, params = {}) => {
        const url = `${baseUrl}/wp-json/wc/v3/${endpoint}`;
        const oauthParams = this.generateOAuthParams('GET', url, accessToken, accessTokenSecret, params);
        
        return await axios.get(url, { params: { ...params, ...oauthParams } });
      },
      
      post: async (endpoint, data = {}) => {
        const url = `${baseUrl}/wp-json/wc/v3/${endpoint}`;
        const oauthParams = this.generateOAuthParams('POST', url, accessToken, accessTokenSecret);
        
        return await axios.post(url, data, {
          params: oauthParams,
          headers: { 'Content-Type': 'application/json' }
        });
      },

      put: async (endpoint, data = {}) => {
        const url = `${baseUrl}/wp-json/wc/v3/${endpoint}`;
        const oauthParams = this.generateOAuthParams('PUT', url, accessToken, accessTokenSecret);
        
        return await axios.put(url, data, {
          params: oauthParams,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    };
  }
}

module.exports = new WooOAuthService();
