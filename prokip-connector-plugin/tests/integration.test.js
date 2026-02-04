const request = require('supertest');
const app = require('../app');

describe('Prokip Connector Plugin - Integration Tests', () => {
  let authToken;
  let storeId;
  
  beforeAll(async () => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
    process.env.PROKIP_API_KEY = 'test_api_key';
  });
  
  describe('Health Check', () => {
    test('GET /api/health should return server status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
  
  describe('Store Connection', () => {
    test('POST /api/connect-store should validate WooCommerce credentials', async () => {
      const wooCredentials = {
        platform: 'woocommerce',
        storeUrl: 'https://test-store.com',
        credentials: {
          api_key: 'ck_test_valid_key_12345678901234567890',
          api_secret: 'cs_test_valid_secret_12345678901234567890'
        }
      };
      
      const response = await request(app)
        .post('/api/connect-store')
        .send(wooCredentials)
        .expect(400); // Will fail due to test environment
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
    
    test('POST /api/connect-store should validate Shopify credentials', async () => {
      const shopifyCredentials = {
        platform: 'shopify',
        storeUrl: 'https://test-store.myshopify.com',
        credentials: {
          access_token: 'shpat_test_valid_token_123456789012345678901234567890',
          shop_domain: 'test-store.myshopify.com'
        }
      };
      
      const response = await request(app)
        .post('/api/connect-store')
        .send(shopifyCredentials)
        .expect(400); // Will fail due to test environment
      
      expect(response.body).toHaveProperty('success', false);
    });
    
    test('POST /api/connect-store should reject invalid platform', async () => {
      const invalidCredentials = {
        platform: 'invalid_platform',
        storeUrl: 'https://test-store.com',
        credentials: {}
      };
      
      const response = await request(app)
        .post('/api/connect-store')
        .send(invalidCredentials)
        .expect(400);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Unsupported platform');
    });
    
    test('POST /api/connect-store should validate required fields', async () => {
      const incompleteData = {
        platform: 'woocommerce'
        // Missing storeUrl and credentials
      };
      
      const response = await request(app)
        .post('/api/connect-store')
        .send(incompleteData)
        .expect(400);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Missing required fields');
    });
  });
  
  describe('Connection Testing', () => {
    test('POST /api/test-connection should validate store_id', async () => {
      const response = await request(app)
        .post('/api/test-connection')
        .send({})
        .expect(400);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Missing required field: store_id');
    });
  });
  
  describe('Sync Operations', () => {
    test('POST /api/sync-products should validate store_id', async () => {
      const response = await request(app)
        .post('/api/sync-products')
        .send({})
        .expect(400);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Missing required field: store_id');
    });
    
    test('POST /api/sync-orders should validate store_id', async () => {
      const response = await request(app)
        .post('/api/sync-orders')
        .send({})
        .expect(400);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Missing required field: store_id');
    });
  });
  
  describe('Platform Adapters', () => {
    test('WooCommerce adapter should validate credentials format', async () => {
      const WooCommerceAdapter = require('../adapters/WooCommerceAdapter');
      const adapter = new WooCommerceAdapter();
      
      // Test valid credentials
      const validCredentials = {
        api_key: 'ck_test_12345678901234567890',
        api_secret: 'cs_test_12345678901234567890'
      };
      
      const validation = adapter.validateCredentials(validCredentials);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      
      // Test invalid credentials
      const invalidCredentials = {
        api_key: 'invalid_key',
        api_secret: 'invalid_secret'
      };
      
      const invalidValidation = adapter.validateCredentials(invalidCredentials);
      expect(invalidValidation.isValid).toBe(false);
      expect(invalidValidation.errors.length).toBeGreaterThan(0);
    });
    
    test('Shopify adapter should validate credentials format', async () => {
      const ShopifyAdapter = require('../adapters/ShopifyAdapter');
      const adapter = new ShopifyAdapter();
      
      // Test valid credentials
      const validCredentials = {
        access_token: 'shpat_test_123456789012345678901234567890',
        shop_domain: 'test-store.myshopify.com'
      };
      
      const validation = adapter.validateCredentials(validCredentials);
      expect(validation.isValid).toBe(true);
      
      // Test invalid domain
      const invalidCredentials = {
        access_token: 'shpat_test_123456789012345678901234567890',
        shop_domain: 'invalid-domain'
      };
      
      const invalidValidation = adapter.validateCredentials(invalidCredentials);
      expect(invalidValidation.isValid).toBe(false);
    });
  });
  
  describe('Prokip Service', () => {
    test('should initialize with correct configuration', () => {
      const ProkipService = require('../services/ProkipService');
      
      // Test with environment variable
      process.env.PROKIP_API_KEY = 'test_key';
      const service = new ProkipService();
      
      expect(service.baseURL).toBe('https://api.prokip.africa');
      expect(service.apiKey).toBe('test_key');
    });
    
    test('should throw error without API key', () => {
      const ProkipService = require('../services/ProkipService');
      
      delete process.env.PROKIP_API_KEY;
      
      expect(() => {
        new ProkipService();
      }).toThrow('PROKIP_API_KEY environment variable is required');
    });
  });
  
  describe('Error Handling', () => {
    test('should handle 404 errors gracefully', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
    
    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/connect-store')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);
    });
  });
  
  describe('Security', () => {
    test('should have security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });
});

describe('E-commerce to Prokip Sync Integration', () => {
  test('should handle WooCommerce product sync flow', async () => {
    // Mock WooCommerce product data
    const mockProduct = {
      id: 123,
      name: 'Test Product',
      sku: 'TEST-001',
      price: '29.99',
      stock_quantity: 100,
      manage_stock: true
    };
    
    const WooCommerceAdapter = require('../adapters/WooCommerceAdapter');
    const adapter = new WooCommerceAdapter();
    
    const transformedProduct = adapter.transformProduct(mockProduct);
    
    expect(transformedProduct).toHaveProperty('external_id', '123');
    expect(transformedProduct).toHaveProperty('name', 'Test Product');
    expect(transformedProduct).toHaveProperty('sku', 'TEST-001');
    expect(transformedProduct).toHaveProperty('price', 29.99);
    expect(transformedProduct).toHaveProperty('platform', 'woocommerce');
  });
  
  test('should handle Shopify product sync flow', async () => {
    // Mock Shopify product data
    const mockProduct = {
      id: 456,
      title: 'Test Shopify Product',
      variants: [{
        id: 789,
        sku: 'SHOPIFY-001',
        price: '39.99',
        inventory_quantity: 50,
        inventory_management: 'shopify'
      }]
    };
    
    const ShopifyAdapter = require('../adapters/ShopifyAdapter');
    const adapter = new ShopifyAdapter();
    
    const transformedProduct = adapter.transformProduct(mockProduct);
    
    expect(transformedProduct).toHaveProperty('external_id', '456');
    expect(transformedProduct).toHaveProperty('name', 'Test Shopify Product');
    expect(transformedProduct).toHaveProperty('platform', 'shopify');
  });
  
  test('should handle order transformation consistently', async () => {
    // Mock order data
    const mockOrder = {
      id: 1001,
      number: '1001',
      total: '99.99',
      customer: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com'
      },
      line_items: [{
        id: 2001,
        product_id: 123,
        name: 'Test Product',
        quantity: 2,
        price: '49.99'
      }]
    };
    
    const WooCommerceAdapter = require('../adapters/WooCommerceAdapter');
    const adapter = new WooCommerceAdapter();
    
    const transformedOrder = adapter.transformOrder(mockOrder);
    
    expect(transformedOrder).toHaveProperty('external_id', '1001');
    expect(transformedOrder).toHaveProperty('total', 99.99);
    expect(transformedOrder.customer).toHaveProperty('email', 'john@example.com');
    expect(transformedOrder.line_items).toHaveLength(1);
    expect(transformedOrder.line_items[0]).toHaveProperty('quantity', 2);
  });
});
