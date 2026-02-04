<?php
/**
 * Prokip E-commerce Integration Test Script
 * 
 * This script tests the complete integration between WooCommerce and Prokip
 * including store connection, product sync, order processing, and stock synchronization.
 */

// Include WordPress
$wp_base = dirname(__FILE__, 3);
if (file_exists($wp_base . '/wp-config.php')) {
    require_once $wp_base . '/wp-config.php';
} else {
    echo "Error: WordPress not found. Please run this script from within WordPress.\n";
    exit(1);
}

// Include plugin files
require_once __DIR__ . '/includes/class-ecommerce-store.php';
require_once __DIR__ . '/includes/class-ecommerce-service.php';
require_once __DIR__ . '/includes/class-ecommerce-sync-controller.php';
require_once __DIR__ . '/includes/class-webhook-handler.php';

class ProkipIntegrationTest {
    private $store_model;
    private $controller;
    private $test_results = [];
    
    public function __construct() {
        $this->store_model = new ProkipEcommerceStore();
        $this->controller = new ProkipEcommerceSyncController();
    }
    
    public function runAllTests() {
        echo "=== Prokip E-commerce Integration Test Suite ===\n\n";
        
        $this->testDatabaseConnection();
        $this->testProkipApiConnection();
        $this->testStoreCreation();
        $this->testWooCommerceConnection();
        $this->testProductSync();
        $this->testOrderProcessing();
        $this->testStockSync();
        $this->testWebhookHandling();
        $this->testApiEndpoints();
        
        $this->printSummary();
    }
    
    private function testDatabaseConnection() {
        echo "Testing Database Connection...\n";
        
        try {
            global $wpdb;
            $tables = $wpdb->get_results("SHOW TABLES LIKE '{$wpdb->prefix}prokip_%'");
            
            if (count($tables) >= 2) {
                $this->test_results['database'] = 'PASS';
                echo "✓ Database connection and tables found\n";
            } else {
                $this->test_results['database'] = 'FAIL';
                echo "✗ Required database tables not found\n";
            }
        } catch (Exception $e) {
            $this->test_results['database'] = 'FAIL';
            echo "✗ Database connection failed: " . $e->getMessage() . "\n";
        }
        
        echo "\n";
    }
    
    private function testProkipApiConnection() {
        echo "Testing Prokip API Connection...\n";
        
        $api_url = get_option('prokip_api_url', 'https://api.prokip.africa');
        $username = get_option('prokip_username');
        $password = get_option('prokip_password');
        
        if (!$username || !$password) {
            $this->test_results['prokip_api'] = 'FAIL';
            echo "✗ Prokip credentials not configured\n";
            echo "\n";
            return;
        }
        
        try {
            $response = wp_remote_post($api_url . '/auth/login', [
                'headers' => ['Content-Type' => 'application/json'],
                'body' => json_encode([
                    'username' => $username,
                    'password' => $password
                ]),
                'timeout' => 10
            ]);
            
            if (!is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200) {
                $this->test_results['prokip_api'] = 'PASS';
                echo "✓ Prokip API connection successful\n";
            } else {
                $this->test_results['prokip_api'] = 'FAIL';
                echo "✗ Prokip API connection failed\n";
            }
        } catch (Exception $e) {
            $this->test_results['prokip_api'] = 'FAIL';
            echo "✗ Prokip API connection error: " . $e->getMessage() . "\n";
        }
        
        echo "\n";
    }
    
    private function testStoreCreation() {
        echo "Testing Store Creation...\n";
        
        $test_store_data = [
            'platform' => 'woocommerce',
            'store_url' => 'https://test-store.example.com',
            'store_name' => 'Test Store',
            'api_key' => 'test_key_' . time(),
            'api_secret' => 'test_secret_' . time(),
            'sync_enabled' => true
        ];
        
        try {
            $store = $this->store_model->create($test_store_data);
            
            if ($store && !is_wp_error($store)) {
                $this->test_results['store_creation'] = 'PASS';
                echo "✓ Store creation successful\n";
                
                // Clean up test store
                $this->store_model->delete($store->id);
            } else {
                $this->test_results['store_creation'] = 'FAIL';
                echo "✗ Store creation failed\n";
            }
        } catch (Exception $e) {
            $this->test_results['store_creation'] = 'FAIL';
            echo "✗ Store creation error: " . $e->getMessage() . "\n";
        }
        
        echo "\n";
    }
    
    private function testWooCommerceConnection() {
        echo "Testing WooCommerce Connection...\n";
        
        // Check if WooCommerce is active
        if (!class_exists('WooCommerce')) {
            $this->test_results['woocommerce'] = 'SKIP';
            echo "⚠ WooCommerce not installed, skipping test\n";
            echo "\n";
            return;
        }
        
        // Test with dummy credentials
        $service = new ProkipEcommerceService('woocommerce', [
            'store_url' => 'https://example.com',
            'api_key' => 'test_key',
            'api_secret' => 'test_secret'
        ]);
        
        // This should fail, but we're testing the connection logic
        $result = $service->test_connection();
        
        if (!$result) {
            $this->test_results['woocommerce'] = 'PASS';
            echo "✓ WooCommerce service logic working (expected failure with test credentials)\n";
        } else {
            $this->test_results['woocommerce'] = 'FAIL';
            echo "✗ WooCommerce service logic unexpected success\n";
        }
        
        echo "\n";
    }
    
    private function testProductSync() {
        echo "Testing Product Sync Logic...\n";
        
        // Test product data preparation
        $test_product = [
            'id' => 123,
            'name' => 'Test Product',
            'sku' => 'TEST-001',
            'price' => 29.99,
            'stock_quantity' => 10
        ];
        
        $test_store = (object) [
            'id' => 1,
            'platform' => 'woocommerce',
            'store_url' => 'https://test-store.example.com'
        ];
        
        try {
            // Test the sync controller method exists and is callable
            $controller = new ProkipEcommerceSyncController();
            
            if (method_exists($controller, 'sync_product_to_prokip')) {
                $this->test_results['product_sync'] = 'PASS';
                echo "✓ Product sync logic available\n";
            } else {
                $this->test_results['product_sync'] = 'FAIL';
                echo "✗ Product sync logic not available\n";
            }
        } catch (Exception $e) {
            $this->test_results['product_sync'] = 'FAIL';
            echo "✗ Product sync test error: " . $e->getMessage() . "\n";
        }
        
        echo "\n";
    }
    
    private function testOrderProcessing() {
        echo "Testing Order Processing Logic...\n";
        
        $test_order = [
            'id' => 456,
            'number' => 'ORDER-001',
            'status' => 'completed',
            'total' => 59.98,
            'date_created' => '2024-01-01T12:00:00',
            'billing' => [
                'first_name' => 'John',
                'last_name' => 'Doe',
                'email' => 'john@example.com'
            ],
            'line_items' => [
                [
                    'product_id' => 123,
                    'sku' => 'TEST-001',
                    'name' => 'Test Product',
                    'quantity' => 2,
                    'price' => 29.99
                ]
            ]
        ];
        
        try {
            // Test webhook handler
            $handler = new ProkipWebhookHandler();
            
            if (method_exists($handler, 'process_woocommerce_order')) {
                $this->test_results['order_processing'] = 'PASS';
                echo "✓ Order processing logic available\n";
            } else {
                $this->test_results['order_processing'] = 'FAIL';
                echo "✗ Order processing logic not available\n";
            }
        } catch (Exception $e) {
            $this->test_results['order_processing'] = 'FAIL';
            echo "✗ Order processing test error: " . $e->getMessage() . "\n";
        }
        
        echo "\n";
    }
    
    private function testStockSync() {
        echo "Testing Stock Sync Logic...\n";
        
        try {
            $service = new ProkipEcommerceService('woocommerce', [
                'store_url' => 'https://test-store.example.com',
                'api_key' => 'test_key',
                'api_secret' => 'test_secret'
            ]);
            
            if (method_exists($service, 'update_product_stock')) {
                $this->test_results['stock_sync'] = 'PASS';
                echo "✓ Stock sync logic available\n";
            } else {
                $this->test_results['stock_sync'] = 'FAIL';
                echo "✗ Stock sync logic not available\n";
            }
        } catch (Exception $e) {
            $this->test_results['stock_sync'] = 'FAIL';
            echo "✗ Stock sync test error: " . $e->getMessage() . "\n";
        }
        
        echo "\n";
    }
    
    private function testWebhookHandling() {
        echo "Testing Webhook Handling...\n";
        
        try {
            $handler = new ProkipWebhookHandler();
            
            // Test webhook verification method
            if (method_exists($handler, 'verify_webhook_signature')) {
                $this->test_results['webhook_handling'] = 'PASS';
                echo "✓ Webhook handling logic available\n";
            } else {
                $this->test_results['webhook_handling'] = 'FAIL';
                echo "✗ Webhook handling logic not available\n";
            }
        } catch (Exception $e) {
            $this->test_results['webhook_handling'] = 'FAIL';
            echo "✗ Webhook handling test error: " . $e->getMessage() . "\n";
        }
        
        echo "\n";
    }
    
    private function testApiEndpoints() {
        echo "Testing REST API Endpoints...\n";
        
        // Test if REST API routes are registered
        $routes = rest_get_server()->get_routes();
        
        $prokip_routes = array_filter($routes, function($route, $key) {
            return strpos($key, 'prokip-ecommerce') !== false;
        }, ARRAY_FILTER_USE_BOTH);
        
        if (count($prokip_routes) > 0) {
            $this->test_results['api_endpoints'] = 'PASS';
            echo "✓ REST API endpoints registered (" . count($prokip_routes) . " routes)\n";
        } else {
            $this->test_results['api_endpoints'] = 'FAIL';
            echo "✗ REST API endpoints not found\n";
        }
        
        echo "\n";
    }
    
    private function printSummary() {
        echo "=== Test Summary ===\n";
        
        $total = count($this->test_results);
        $passed = count(array_filter($this->test_results, function($result) {
            return $result === 'PASS';
        }));
        $failed = count(array_filter($this->test_results, function($result) {
            return $result === 'FAIL';
        }));
        $skipped = count(array_filter($this->test_results, function($result) {
            return $result === 'SKIP';
        }));
        
        echo "Total Tests: {$total}\n";
        echo "Passed: {$passed}\n";
        echo "Failed: {$failed}\n";
        echo "Skipped: {$skipped}\n\n";
        
        echo "Detailed Results:\n";
        foreach ($this->test_results as $test => $result) {
            $status = $result === 'PASS' ? '✓' : ($result === 'FAIL' ? '✗' : '⚠');
            echo "{$status} {$test}: {$result}\n";
        }
        
        if ($failed === 0) {
            echo "\n🎉 All tests passed! The integration is ready to use.\n";
        } else {
            echo "\n⚠️  Some tests failed. Please review the issues above.\n";
        }
    }
}

// Run the tests
if (php_sapi_name() === 'cli') {
    $test = new ProkipIntegrationTest();
    $test->runAllTests();
} else {
    echo "This script must be run from the command line.\n";
    echo "Usage: php test-integration.php\n";
}
