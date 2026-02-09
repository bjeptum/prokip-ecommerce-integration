const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:3000',
    video: false,
    defaultCommandTimeout: 15000,
    supportFile: false
  }
});
