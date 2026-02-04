/**
 * Legacy Prokip user auth service disabled in /api/ecom mode.
 */

class ProkipUserAuthService {
  async login() {
    throw new Error('Prokip user auth disabled. Use dashboard token for /api/ecom/*.');
  }

  async getUserProfile() {
    throw new Error('Prokip user auth disabled. Use dashboard token for /api/ecom/*.');
  }
}

module.exports = new ProkipUserAuthService();
