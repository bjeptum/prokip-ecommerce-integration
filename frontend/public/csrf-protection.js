// Frontend CSRF helper for WooCommerce-Prokip integration
// This script should be included in your frontend to handle CSRF protection

class CSRFProtection {
  constructor() {
    this.csrfToken = null;
    this.init();
  }

  async init() {
    try {
      const response = await fetch('/api/csrf-token');
      const data = await response.json();
      this.csrfToken = data.csrfToken;
      console.log('CSRF token obtained successfully');
    } catch (error) {
      console.error('Failed to get CSRF token:', error);
    }
  }

  // Add CSRF token to fetch requests
  addCSRFToOptions(options = {}) {
    if (!this.csrfToken) {
      console.warn('CSRF token not available');
      return options;
    }

    // Add CSRF token to headers
    options.headers = {
      ...options.headers,
      'X-CSRF-Token': this.csrfToken
    };

    // Add CSRF token to body if it's FormData or JSON
    if (options.body && typeof options.body === 'object') {
      if (options.body instanceof FormData) {
        options.body.append('_csrf', this.csrfToken);
      } else {
        options.body._csrf = this.csrfToken;
      }
    }

    return options;
  }

  // Wrapper for fetch with CSRF protection
  async fetchWithCSRF(url, options = {}) {
    const csrfOptions = this.addCSRFToOptions(options);
    return fetch(url, csrfOptions);
  }

  // Wrapper for axios with CSRF protection
  addCSRFToAxiosConfig(config = {}) {
    if (!this.csrfToken) {
      console.warn('CSRF token not available');
      return config;
    }

    config.headers = {
      ...config.headers,
      'X-CSRF-Token': this.csrfToken
    };

    // Add CSRF token to data if it exists
    if (config.data && typeof config.data === 'object') {
      config.data._csrf = this.csrfToken;
    }

    return config;
  }
}

// Global instance
window.csrfProtection = new CSRFProtection();

// Auto-refresh CSRF token every 50 minutes
setInterval(() => {
  window.csrfProtection.init();
}, 50 * 60 * 1000);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CSRFProtection;
}
