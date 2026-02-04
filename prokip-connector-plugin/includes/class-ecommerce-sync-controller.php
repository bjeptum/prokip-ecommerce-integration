<?php
/**
 * E-commerce Sync Controller
 * 
 * Handles REST API endpoints for store connections and sync operations
 */

if (!defined('ABSPATH')) {
    exit;
}

class ProkipEcommerceSyncController
{
    private $store_model;
    private $prokip_api_url = 'https://api.prokip.africa';

    public function __construct()
    {
        $this->store_model = new ProkipEcommerceStore();
    }

    /**
     * Connect a new store
     */
    public function connect_store(WP_REST_Request $request)
    {
        $platform = $request['platform'];
        $store_url = $request['store_url'];
        $api_key = $request['api_key'];
        $api_secret = $request['api_secret'];
        $store_name = $request['store_name'];

        // Validate required fields
        if (empty($platform) || empty($store_url)) {
            return new WP_Error('missing_fields', 'Platform and store URL are required', ['status' => 400]);
        }

        // Test connection before saving
        $service = new ProkipEcommerceService($platform, [
            'store_url' => $store_url,
            'api_key' => $api_key,
            'api_secret' => $api_secret
        ]);

        if (!$service->test_connection()) {
            return new WP_Error('connection_failed', 'Connection test failed: ' . $service->get_last_error(), ['status' => 400]);
        }

        // Create store connection
        $store_data = [
            'platform' => $platform,
            'store_url' => $store_url,
            'store_name' => $store_name ?: $platform . ' Store',
            'api_key' => $api_key,
            'api_secret' => $api_secret,
            'sync_enabled' => true
        ];

        $store = $this->store_model->create($store_data);

        if (is_wp_error($store)) {
            return $store;
        }

        // Register webhooks for real-time sync
        $this->register_webhooks($store);

        return [
            'success' => true,
            'message' => 'Store connected successfully',
            'store' => $store
        ];
    }

    /**
     * Disconnect a store
     */
    public function disconnect_store(WP_REST_Request $request)
    {
        $store_id = $request['id'];
        
        $store = $this->store_model->get_by_id($store_id);
        if (!$store) {
            return new WP_Error('store_not_found', 'Store not found', ['status' => 404]);
        }

        $result = $this->store_model->delete($store_id);

        if (is_wp_error($result)) {
            return $result;
        }

        return [
            'success' => true,
            'message' => 'Store disconnected successfully'
        ];
    }

    /**
     * Get all connected stores
     */
    public function get_stores(WP_REST_Request $request)
    {
        $stores = $this->store_model->get_all_for_user();
        
        return [
            'success' => true,
            'stores' => $stores
        ];
    }

    /**
     * Sync products from store to Prokip
     */
    public function sync_products(WP_REST_Request $request)
    {
        $store_id = $request['store_id'];
        
        $store = $this->store_model->get_by_id($store_id);
        if (!$store) {
            return new WP_Error('store_not_found', 'Store not found', ['status' => 404]);
        }

        $service = new ProkipEcommerceService($store->platform, [
            'store_url' => $store->store_url,
            'api_key' => $store->api_key,
            'api_secret' => $store->api_secret,
            'access_token' => $store->access_token
        ]);

        $products = $service->get_products(100, 1);
        $synced_count = 0;
        $errors = [];

        foreach ($products as $product) {
            $result = $this->sync_product_to_prokip($product, $store);
            if ($result) {
                $synced_count++;
            } else {
                $errors[] = "Failed to sync product: {$product['name']}";
            }
        }

        // Update last sync time
        $this->store_model->update_last_sync($store_id);

        return [
            'success' => true,
            'message' => "Synced {$synced_count} products to Prokip",
            'synced_count' => $synced_count,
            'total_products' => count($products),
            'errors' => $errors
        ];
    }

    /**
     * Sync orders from store to Prokip
     */
    public function sync_orders(WP_REST_Request $request)
    {
        $store_id = $request['store_id'];
        $status = $request['status'] ?? 'completed';
        
        $store = $this->store_model->get_by_id($store_id);
        if (!$store) {
            return new WP_Error('store_not_found', 'Store not found', ['status' => 404]);
        }

        $service = new ProkipEcommerceService($store->platform, [
            'store_url' => $store->store_url,
            'api_key' => $store->api_key,
            'api_secret' => $store->api_secret,
            'access_token' => $store->access_token
        ]);

        $orders = $service->get_orders(50, 1, $status);
        $synced_count = 0;
        $errors = [];

        foreach ($orders as $order) {
            $result = $this->sync_order_to_prokip($order, $store);
            if ($result) {
                $synced_count++;
            } else {
                $errors[] = "Failed to sync order: {$order['id']}";
            }
        }

        return [
            'success' => true,
            'message' => "Synced {$synced_count} orders to Prokip",
            'synced_count' => $synced_count,
            'total_orders' => count($orders),
            'errors' => $errors
        ];
    }

    /**
     * Sync inventory from Prokip to store
     */
    public function sync_inventory(WP_REST_Request $request)
    {
        $store_id = $request['store_id'];
        
        $store = $this->store_model->get_by_id($store_id);
        if (!$store) {
            return new WP_Error('store_not_found', 'Store not found', ['status' => 404]);
        }

        // Get inventory from Prokip
        $prokip_inventory = $this->get_prokip_inventory();
        if (!$prokip_inventory) {
            return new WP_Error('prokip_error', 'Failed to fetch inventory from Prokip', ['status' => 500]);
        }

        $service = new ProkipEcommerceService($store->platform, [
            'store_url' => $store->store_url,
            'api_key' => $store->api_key,
            'api_secret' => $store->api_secret,
            'access_token' => $store->access_token
        ]);

        $synced_count = 0;
        $errors = [];

        foreach ($prokip_inventory as $item) {
            $result = $service->update_product_stock($item['product_id'], $item['stock_quantity'], $item['sku']);
            if ($result) {
                $synced_count++;
            } else {
                $errors[] = "Failed to update stock for SKU: {$item['sku']}";
            }
        }

        // Update last sync time
        $this->store_model->update_last_sync($store_id);

        return [
            'success' => true,
            'message' => "Updated inventory for {$synced_count} products",
            'synced_count' => $synced_count,
            'total_items' => count($prokip_inventory),
            'errors' => $errors
        ];
    }

    /**
     * Register webhooks for real-time sync
     */
    private function register_webhooks($store)
    {
        $webhook_url = rest_url('prokip-ecommerce/v1/webhook/' . $store->platform);
        
        $service = new ProkipEcommerceService($store->platform, [
            'store_url' => $store->store_url,
            'api_key' => $store->api_key,
            'api_secret' => $store->api_secret,
            'access_token' => $store->access_token
        ]);

        // Register different webhook topics based on platform
        $webhooks = [];

        if ($store->platform === 'woocommerce') {
            $webhooks = [
                'order.created',
                'order.updated',
                'product.updated',
                'product.deleted'
            ];
        } elseif ($store->platform === 'shopify') {
            $webhooks = [
                'orders/create',
                'orders/updated',
                'products/create',
                'products/update',
                'products/delete'
            ];
        }

        foreach ($webhooks as $topic) {
            $service->create_webhook($topic, $webhook_url);
        }
    }

    /**
     * Sync a single product to Prokip
     */
    private function sync_product_to_prokip($product, $store)
    {
        // Get Prokip auth token
        $token = $this->get_prokip_token();
        if (!$token) {
            return false;
        }

        // Prepare product data for Prokip
        $prokip_product = [
            'name' => $product['name'],
            'sku' => $product['sku'] ?? '',
            'price' => $product['price'] ?? 0,
            'stock_quantity' => $product['stock_quantity'] ?? 0,
            'platform' => $store->platform,
            'platform_product_id' => $product['id'],
            'store_id' => $store->id
        ];

        // Send to Prokip API
        $response = wp_remote_post($this->prokip_api_url . '/products', [
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Content-Type' => 'application/json'
            ],
            'body' => json_encode($prokip_product),
            'timeout' => 30
        ]);

        return !is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200;
    }

    /**
     * Sync a single order to Prokip
     */
    private function sync_order_to_prokip($order, $store)
    {
        // Get Prokip auth token
        $token = $this->get_prokip_token();
        if (!$token) {
            return false;
        }

        // Prepare order data for Prokip
        $prokip_order = [
            'order_id' => $order['id'],
            'order_number' => $order['number'] ?? $order['id'],
            'customer_name' => $order['billing']['first_name'] . ' ' . $order['billing']['last_name'] ?? '',
            'customer_email' => $order['billing']['email'] ?? '',
            'total_amount' => $order['total'] ?? 0,
            'status' => $order['status'] ?? 'pending',
            'order_date' => $order['date_created'] ?? $order['created_at'],
            'platform' => $store->platform,
            'store_id' => $store->id,
            'line_items' => $this->prepare_order_items($order['line_items'] ?? [])
        ];

        // Send to Prokip API
        $response = wp_remote_post($this->prokip_api_url . '/orders', [
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Content-Type' => 'application/json'
            ],
            'body' => json_encode($prokip_order),
            'timeout' => 30
        ]);

        return !is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200;
    }

    /**
     * Get inventory from Prokip
     */
    private function get_prokip_inventory()
    {
        $token = $this->get_prokip_token();
        if (!$token) {
            return false;
        }

        $response = wp_remote_get($this->prokip_api_url . '/inventory', [
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Content-Type' => 'application/json'
            ],
            'timeout' => 30
        ]);

        if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
            return false;
        }

        $body = wp_remote_retrieve_body($response);
        return json_decode($body, true);
    }

    /**
     * Get Prokip authentication token
     */
    private function get_prokip_token()
    {
        // This should be stored in WordPress options or user meta
        // For now, we'll use a simple approach
        $token = get_option('prokip_api_token');
        
        if (!$token) {
            // Try to authenticate with Prokip
            $username = get_option('prokip_username');
            $password = get_option('prokip_password');
            
            if ($username && $password) {
                $response = wp_remote_post($this->prokip_api_url . '/auth/login', [
                    'headers' => [
                        'Content-Type' => 'application/json'
                    ],
                    'body' => json_encode([
                        'username' => $username,
                        'password' => $password
                    ]),
                    'timeout' => 30
                ]);

                if (!is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200) {
                    $body = wp_remote_retrieve_body($response);
                    $data = json_decode($body, true);
                    $token = $data['token'] ?? null;
                    
                    if ($token) {
                        update_option('prokip_api_token', $token);
                    }
                }
            }
        }

        return $token;
    }

    /**
     * Prepare order items for Prokip
     */
    private function prepare_order_items($line_items)
    {
        $items = [];
        
        foreach ($line_items as $item) {
            $items[] = [
                'product_id' => $item['product_id'] ?? $item['id'],
                'sku' => $item['sku'] ?? '',
                'name' => $item['name'] ?? '',
                'quantity' => $item['quantity'] ?? 1,
                'price' => $item['price'] ?? 0
            ];
        }
        
        return $items;
    }
}
