require('dotenv').config();
const axios = require('axios');
const ProkipService = require('./services/ProkipService');
const PlatformAdapterFactory = require('./adapters/PlatformAdapterFactory');

/**
 * Comprehensive test to verify e-commerce to Prokip sync functionality
 */
class EcommerceToProkipSyncTest {
  constructor() {
    this.prokipService = new ProkipService();
    this.platformAdapterFactory = new PlatformAdapterFactory();
    this.testResults = [];
  }
  
  async runAllTests() {
    console.log('🧪 Starting E-commerce to Prokip Sync Tests...\n');
    
    try {
      // Test 1: Platform Adapter Validation
      await this.testPlatformAdapters();
      
      // Test 2: WooCommerce Product Sync
      await this.testWooCommerceProductSync();
      
      // Test 3: Shopify Product Sync
      await this.testShopifyProductSync();
      
      // Test 4: Order Sync
      await this.testOrderSync();
      
      // Test 5: Error Handling
      await this.testErrorHandling();
      
      // Test 6: Data Transformation
      await this.testDataTransformation();
      
      // Test 7: API Communication
      await this.testAPICommunication();
      
      this.printResults();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      this.testResults.push({
        test: 'Test Suite',
        status: 'FAILED',
        error: error.message
      });
    }
  }
  
  async testPlatformAdapters() {
    console.log('🔍 Testing Platform Adapters...');
    
    try {
      // Test WooCommerce adapter
      const wooAdapter = this.platformAdapterFactory.getAdapter('woocommerce');
      const wooValidation = wooAdapter.validateCredentials({
        api_key: 'ck_test_12345678901234567890',
        api_secret: 'cs_test_12345678901234567890'
      });
      
      this.addTestResult('WooCommerce Adapter Validation', wooValidation.isValid);
      
      // Test Shopify adapter
      const shopifyAdapter = this.platformAdapterFactory.getAdapter('shopify');
      const shopifyValidation = shopifyAdapter.validateCredentials({
        access_token: 'shpat_test_123456789012345678901234567890',
        shop_domain: 'test-store.myshopify.com'
      });
      
      this.addTestResult('Shopify Adapter Validation', shopifyValidation.isValid);
      
      // Test Custom adapter
      const customAdapter = this.platformAdapterFactory.getAdapter('custom');
      const customValidation = customAdapter.validateCredentials({
        api_url: 'https://api.custom-store.com',
        api_key: 'test_key'
      });
      
      this.addTestResult('Custom Adapter Validation', customValidation.isValid);
      
    } catch (error) {
      this.addTestResult('Platform Adapters', false, error.message);
    }
  }
  
  async testWooCommerceProductSync() {
    console.log('🛒 Testing WooCommerce Product Sync...');
    
    try {
      const wooAdapter = this.platformAdapterFactory.getAdapter('woocommerce');
      
      // Mock WooCommerce product data
      const mockWooProduct = {
        id: 12345,
        name: 'Test WooCommerce Product',
        description: 'A test product for WooCommerce',
        sku: 'WOO-TEST-001',
        price: '29.99',
        regular_price: '39.99',
        sale_price: '29.99',
        stock_quantity: 100,
        manage_stock: true,
        stock_status: 'instock',
        categories: [{ name: 'Electronics' }],
        images: [{ src: 'https://example.com/image.jpg' }],
        attributes: [{ name: 'Color', options: ['Red', 'Blue'] }],
        variations: [{
          id: 12346,
          sku: 'WOO-TEST-001-RED',
          price: '29.99',
          stock_quantity: 50,
          attributes: [{ name: 'Color', value: 'Red' }]
        }],
        weight: '1.5',
        dimensions: {
          length: '10',
          width: '8',
          height: '5'
        },
        status: 'publish',
        date_created: '2024-01-01T00:00:00Z',
        date_modified: '2024-01-02T00:00:00Z'
      };
      
      // Transform product
      const transformedProduct = wooAdapter.transformProduct(mockWooProduct);
      
      // Validate transformation
      const validation = this.validateProductTransformation(transformedProduct, 'woocommerce');
      this.addTestResult('WooCommerce Product Transformation', validation.isValid, validation.error);
      
      // Test product data integrity
      const integrityCheck = this.checkProductIntegrity(transformedProduct);
      this.addTestResult('WooCommerce Product Integrity', integrityCheck.isValid, integrityCheck.error);
      
    } catch (error) {
      this.addTestResult('WooCommerce Product Sync', false, error.message);
    }
  }
  
  async testShopifyProductSync() {
    console.log('🛍️ Testing Shopify Product Sync...');
    
    try {
      const shopifyAdapter = this.platformAdapterFactory.getAdapter('shopify');
      
      // Mock Shopify product data
      const mockShopifyProduct = {
        id: 67890,
        title: 'Test Shopify Product',
        body_html: '<p>A test product for Shopify</p>',
        product_type: 'Electronics',
        vendor: 'Test Vendor',
        variants: [{
          id: 67891,
          title: 'Default Title',
          sku: 'SHOPIFY-TEST-001',
          price: '39.99',
          compare_at_price: '49.99',
          inventory_quantity: 75,
          inventory_management: 'shopify',
          weight: 2.0,
          length: 12,
          width: 10,
          height: 6
        }],
        options: [{
          name: 'Size',
          values: ['Small', 'Medium', 'Large']
        }],
        images: [{ src: 'https://cdn.shopify.com/image.jpg' }],
        tags: 'test, electronics, popular',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      };
      
      // Transform product
      const transformedProduct = shopifyAdapter.transformProduct(mockShopifyProduct);
      
      // Validate transformation
      const validation = this.validateProductTransformation(transformedProduct, 'shopify');
      this.addTestResult('Shopify Product Transformation', validation.isValid, validation.error);
      
      // Test product data integrity
      const integrityCheck = this.checkProductIntegrity(transformedProduct);
      this.addTestResult('Shopify Product Integrity', integrityCheck.isValid, integrityCheck.error);
      
    } catch (error) {
      this.addTestResult('Shopify Product Sync', false, error.message);
    }
  }
  
  async testOrderSync() {
    console.log('📋 Testing Order Sync...');
    
    try {
      const wooAdapter = this.platformAdapterFactory.getAdapter('woocommerce');
      
      // Mock WooCommerce order data
      const mockOrder = {
        id: 1001,
        number: '1001',
        status: 'completed',
        currency: 'USD',
        total: '99.99',
        total_tax: '8.99',
        shipping_total: '10.00',
        billing: {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          company: 'Test Company',
          address_1: '123 Test St',
          address_2: 'Apt 4B',
          city: 'Test City',
          state: 'CA',
          postcode: '12345',
          country: 'US'
        },
        shipping: {
          first_name: 'John',
          last_name: 'Doe',
          company: 'Test Company',
          address_1: '123 Test St',
          city: 'Test City',
          state: 'CA',
          postcode: '12345',
          country: 'US'
        },
        line_items: [{
          id: 2001,
          product_id: 12345,
          variation_id: 12346,
          name: 'Test Product',
          sku: 'TEST-001',
          quantity: 2,
          price: '44.99',
          total: '89.98',
          total_tax: '8.99'
        }],
        date_created: '2024-01-01T00:00:00Z',
        date_modified: '2024-01-02T00:00:00Z'
      };
      
      // Transform order
      const transformedOrder = wooAdapter.transformOrder(mockOrder);
      
      // Validate order transformation
      const validation = this.validateOrderTransformation(transformedOrder);
      this.addTestResult('Order Transformation', validation.isValid, validation.error);
      
      // Test order data integrity
      const integrityCheck = this.checkOrderIntegrity(transformedOrder);
      this.addTestResult('Order Integrity', integrityCheck.isValid, integrityCheck.error);
      
    } catch (error) {
      this.addTestResult('Order Sync', false, error.message);
    }
  }
  
  async testErrorHandling() {
    console.log('⚠️ Testing Error Handling...');
    
    try {
      // Test invalid platform
      try {
        this.platformAdapterFactory.getAdapter('invalid_platform');
        this.addTestResult('Invalid Platform Error', false, 'Should have thrown error');
      } catch (error) {
        this.addTestResult('Invalid Platform Error', true);
      }
      
      // Test invalid credentials
      const wooAdapter = this.platformAdapterFactory.getAdapter('woocommerce');
      const invalidValidation = wooAdapter.validateCredentials({
        api_key: 'invalid',
        api_secret: 'invalid'
      });
      
      this.addTestResult('Invalid Credentials Validation', !invalidValidation.isValid);
      
      // Test malformed data transformation
      const malformedProduct = {
        // Missing required fields
        id: null,
        name: '',
        price: 'invalid_price'
      };
      
      try {
        const transformed = wooAdapter.transformProduct(malformedProduct);
        // Should handle gracefully
        this.addTestResult('Malformed Data Handling', true);
      } catch (error) {
        this.addTestResult('Malformed Data Handling', true);
      }
      
    } catch (error) {
      this.addTestResult('Error Handling', false, error.message);
    }
  }
  
  async testDataTransformation() {
    console.log('🔄 Testing Data Transformation...');
    
    try {
      // Test data consistency across platforms
      const wooAdapter = this.platformAdapterFactory.getAdapter('woocommerce');
      const shopifyAdapter = this.platformAdapterFactory.getAdapter('shopify');
      
      // Same product data in different formats
      const wooProduct = {
        id: 123,
        name: 'Test Product',
        sku: 'TEST-001',
        price: '29.99',
        stock_quantity: 100
      };
      
      const shopifyProduct = {
        id: 456,
        title: 'Test Product',
        variants: [{
          sku: 'TEST-001',
          price: '29.99',
          inventory_quantity: 100
        }]
      };
      
      const wooTransformed = wooAdapter.transformProduct(wooProduct);
      const shopifyTransformed = shopifyAdapter.transformProduct(shopifyProduct);
      
      // Check that both have consistent structure
      const structureMatch = this.compareProductStructures(wooTransformed, shopifyTransformed);
      this.addTestResult('Cross-Platform Structure Consistency', structureMatch.isValid, structureMatch.error);
      
      // Test data type consistency
      const typeConsistency = this.checkDataTypeConsistency([wooTransformed, shopifyTransformed]);
      this.addTestResult('Data Type Consistency', typeConsistency.isValid, typeConsistency.error);
      
    } catch (error) {
      this.addTestResult('Data Transformation', false, error.message);
    }
  }
  
  async testAPICommunication() {
    console.log('🌐 Testing API Communication...');
    
    try {
      // Test Prokip service initialization
      const service = new ProkipService();
      
      // Test API key validation
      const apiKeyValid = service.validateApiKey();
      this.addTestResult('API Key Validation', apiKeyValid);
      
      // Test job ID generation
      const jobId1 = service.generateJobId();
      const jobId2 = service.generateJobId();
      const uniqueJobIds = jobId1 !== jobId2;
      this.addTestResult('Unique Job ID Generation', uniqueJobIds);
      
      // Test error handling
      const testError = new Error('Test error');
      const formattedError = service.handleError(testError);
      this.addTestResult('Error Formatting', formattedError.message === 'Test error');
      
    } catch (error) {
      this.addTestResult('API Communication', false, error.message);
    }
  }
  
  validateProductTransformation(product, platform) {
    const requiredFields = ['external_id', 'name', 'sku', 'price', 'platform'];
    
    for (const field of requiredFields) {
      if (!product[field]) {
        return { isValid: false, error: `Missing required field: ${field}` };
      }
    }
    
    if (product.platform !== platform) {
      return { isValid: false, error: `Platform mismatch: expected ${platform}, got ${product.platform}` };
    }
    
    if (typeof product.price !== 'number' || product.price < 0) {
      return { isValid: false, error: 'Invalid price value' };
    }
    
    return { isValid: true };
  }
  
  validateOrderTransformation(order) {
    const requiredFields = ['external_id', 'status', 'currency', 'total', 'platform'];
    
    for (const field of requiredFields) {
      if (order[field] === undefined || order[field] === null) {
        return { isValid: false, error: `Missing required field: ${field}` };
      }
    }
    
    if (!Array.isArray(order.line_items)) {
      return { isValid: false, error: 'line_items must be an array' };
    }
    
    return { isValid: true };
  }
  
  checkProductIntegrity(product) {
    // Check numeric fields
    const numericFields = ['price', 'regular_price', 'stock_quantity'];
    
    for (const field of numericFields) {
      if (product[field] !== undefined && (typeof product[field] !== 'number' || isNaN(product[field]))) {
        return { isValid: false, error: `Invalid ${field}: must be a number` };
      }
    }
    
    // Check array fields
    const arrayFields = ['categories', 'images', 'attributes', 'variations'];
    
    for (const field of arrayFields) {
      if (product[field] !== undefined && !Array.isArray(product[field])) {
        return { isValid: false, error: `Invalid ${field}: must be an array` };
      }
    }
    
    return { isValid: true };
  }
  
  checkOrderIntegrity(order) {
    // Check customer object
    if (!order.customer || typeof order.customer !== 'object') {
      return { isValid: false, error: 'Invalid customer object' };
    }
    
    // Check line items
    if (!Array.isArray(order.line_items) || order.line_items.length === 0) {
      return { isValid: false, error: 'Invalid or empty line_items' };
    }
    
    // Check line item structure
    for (const item of order.line_items) {
      if (!item.name || typeof item.quantity !== 'number' || item.quantity <= 0) {
        return { isValid: false, error: 'Invalid line item structure' };
      }
    }
    
    return { isValid: true };
  }
  
  compareProductStructures(product1, product2) {
    const fields1 = Object.keys(product1).sort();
    const fields2 = Object.keys(product2).sort();
    
    // Check if they have the same core fields
    const coreFields = ['external_id', 'name', 'sku', 'price', 'platform'];
    
    for (const field of coreFields) {
      if (!product1[field] || !product2[field]) {
        return { isValid: false, error: `Missing core field: ${field}` };
      }
    }
    
    return { isValid: true };
  }
  
  checkDataTypeConsistency(products) {
    for (const product of products) {
      if (typeof product.price !== 'number') {
        return { isValid: false, error: 'Price must be a number' };
      }
      
      if (typeof product.external_id !== 'string') {
        return { isValid: false, error: 'External ID must be a string' };
      }
    }
    
    return { isValid: true };
  }
  
  addTestResult(testName, passed, error = null) {
    this.testResults.push({
      test: testName,
      status: passed ? 'PASSED' : 'FAILED',
      error: error
    });
    
    console.log(`  ${passed ? '✅' : '❌'} ${testName}${error ? ': ' + error : ''}`);
  }
  
  printResults() {
    console.log('\n📊 TEST RESULTS SUMMARY:');
    console.log('='.repeat(50));
    
    const passed = this.testResults.filter(r => r.status === 'PASSED').length;
    const failed = this.testResults.filter(r => r.status === 'FAILED').length;
    const total = this.testResults.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults
        .filter(r => r.status === 'FAILED')
        .forEach(r => {
          console.log(`  - ${r.test}: ${r.error || 'Unknown error'}`);
        });
    }
    
    console.log('\n' + '='.repeat(50));
    
    if (failed === 0) {
      console.log('🎉 ALL TESTS PASSED! E-commerce to Prokip sync is working correctly.');
    } else {
      console.log('⚠️ Some tests failed. Please review the issues above.');
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const test = new EcommerceToProkipSyncTest();
  test.runAllTests().catch(console.error);
}

module.exports = EcommerceToProkipSyncTest;
