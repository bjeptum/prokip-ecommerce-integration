<?php
/**
 * Webhook Handler
 * 
 * Processes incoming webhooks from e-commerce platforms
 */

if (!defined('ABSPATH')) {
    exit;
}

class ProkipWebhookHandler
{
    private $store_model;
    private $prokip_api_url = 'https://api.prokip.africa';

    public function __construct()
    {
        $this->store_model = new ProkipEcommerceStore();
    }

    /**
     * Handle incoming webhook
     */
    public function handle(WP_REST_Request $request)
    {
        $platform = $request['platform'];
        $headers = $request->get_headers();
        $body = $request->get_body();
        $payload = json_decode($body, true);

        // Log webhook for debugging
        $this->log_webhook($platform, $headers, $payload);

        // Verify webhook signature if available
        if (!$this->verify_webhook_signature($platform, $headers, $body)) {
            return new WP_Error('invalid_signature', 'Invalid webhook signature', ['status' => 401]);
        }

        // Process webhook based on platform and event type
        switch ($platform) {
            case 'woocommerce':
                return $this->handle_woocommerce_webhook($headers, $payload);
            case 'shopify':
                return $this->handle_shopify_webhook($headers, $payload);
            default:
                return new WP_Error('unsupported_platform', 'Unsupported platform', ['status' => 400]);
        }
    }

    /**
     * Handle WooCommerce webhooks
     */
    private function handle_woocommerce_webhook($headers, $payload)
    {
        $topic = $this->get_woocommerce_topic($headers);
        
        if (!$topic) {
            return new WP_Error('missing_topic', 'Missing webhook topic', ['status' => 400]);
        }

        switch ($topic) {
            case 'order.created':
            case 'order.updated':
                return $this->process_woocommerce_order($payload, $topic);
            case 'product.updated':
                return $this->process_woocommerce_product_update($payload);
            case 'product.deleted':
                return $this->process_woocommerce_product_delete($payload);
            default:
                return ['success' => true, 'message' => 'Webhook received but not processed'];
        }
    }

    /**
     * Handle Shopify webhooks
     */
    private function handle_shopify_webhook($headers, $payload)
    {
        $topic = $this->get_shopify_topic($headers);
        
        if (!$topic) {
            return new WP_Error('missing_topic', 'Missing webhook topic', ['status' => 400]);
        }

        switch ($topic) {
            case 'orders/create':
            case 'orders/updated':
                return $this->process_shopify_order($payload, $topic);
            case 'products/create':
            case 'products/update':
                return $this->process_shopify_product_update($payload);
            case 'products/delete':
                return $this->process_shopify_product_delete($payload);
            default:
                return ['success' => true, 'message' => 'Webhook received but not processed'];
        }
    }

    /**
     * Process WooCommerce order
     */
    private function process_woocommerce_order($order, $event_type)
    {
        // Find the store connection
        $store = $this->find_store_by_domain($order['site_url'] ?? '');
        if (!$store) {
            return new WP_Error('store_not_found', 'No store connection found', ['status' => 404]);
        }

        // Check if this order should be processed
        if (!$this->should_process_order($order, $event_type)) {
            return ['success' => true, 'message' => 'Order does not meet processing criteria'];
        }

        // Process order in Prokip
        $result = $this->process_order_in_prokip($order, $store, 'woocommerce');
        
        if ($result) {
            return [
                'success' => true,
                'message' => 'Order processed successfully',
                'order_id' => $order['id']
            ];
        } else {
            return new WP_Error('processing_failed', 'Failed to process order in Prokip', ['status' => 500]);
        }
    }

    /**
     * Process Shopify order
     */
    private function process_shopify_order($order, $event_type)
    {
        // Find the store connection
        $store_domain = $order['shop_domain'] ?? '';
        $store = $this->find_store_by_domain($store_domain);
        if (!$store) {
            return new WP_Error('store_not_found', 'No store connection found', ['status' => 404]);
        }

        // Check if this order should be processed
        if (!$this->should_process_order($order, $event_type)) {
            return ['success' => true, 'message' => 'Order does not meet processing criteria'];
        }

        // Process order in Prokip
        $result = $this->process_order_in_prokip($order, $store, 'shopify');
        
        if ($result) {
            return [
                'success' => true,
                'message' => 'Order processed successfully',
                'order_id' => $order['id']
            ];
        } else {
            return new WP_Error('processing_failed', 'Failed to process order in Prokip', ['status' => 500]);
        }
    }

    /**
     * Process WooCommerce product update
     */
    private function process_woocommerce_product_update($product)
    {
        $store = $this->find_store_by_domain($product['site_url'] ?? '');
        if (!$store) {
            return new WP_Error('store_not_found', 'No store connection found', ['status' => 404]);
        }

        // Update product in Prokip
        $result = $this->update_product_in_prokip($product, $store, 'woocommerce');
        
        return [
            'success' => $result,
            'message' => $result ? 'Product updated successfully' : 'Failed to update product'
        ];
    }

    /**
     * Process Shopify product update
     */
    private function process_shopify_product_update($product)
    {
        $store_domain = $product['shop_domain'] ?? '';
        $store = $this->find_store_by_domain($store_domain);
        if (!$store) {
            return new WP_Error('store_not_found', 'No store connection found', ['status' => 404]);
        }

        // Update product in Prokip
        $result = $this->update_product_in_prokip($product, $store, 'shopify');
        
        return [
            'success' => $result,
            'message' => $result ? 'Product updated successfully' : 'Failed to update product'
        ];
    }

    /**
     * Process WooCommerce product deletion
     */
    private function process_woocommerce_product_delete($product)
    {
        $store = $this->find_store_by_domain($product['site_url'] ?? '');
        if (!$store) {
            return new WP_Error('store_not_found', 'No store connection found', ['status' => 404]);
        }

        // Mark product as deleted in Prokip
        $result = $this->delete_product_in_prokip($product, $store, 'woocommerce');
        
        return [
            'success' => $result,
            'message' => $result ? 'Product marked as deleted' : 'Failed to mark product as deleted'
        ];
    }

    /**
     * Process Shopify product deletion
     */
    private function process_shopify_product_delete($product)
    {
        $store_domain = $product['shop_domain'] ?? '';
        $store = $this->find_store_by_domain($store_domain);
        if (!$store) {
            return new WP_Error('store_not_found', 'No store connection found', ['status' => 404]);
        }

        // Mark product as deleted in Prokip
        $result = $this->delete_product_in_prokip($product, $store, 'shopify');
        
        return [
            'success' => $result,
            'message' => $result ? 'Product marked as deleted' : 'Failed to mark product as deleted'
        ];
    }

    /**
     * Find store connection by domain
     */
    private function find_store_by_domain($domain)
    {
        if (empty($domain)) {
            return null;
        }

        // Extract domain from URL
        $domain = parse_url($domain, PHP_URL_HOST);
        if (!$domain) {
            $domain = $domain;
        }

        $stores = $this->store_model->get_all_for_user();
        
        foreach ($stores as $store) {
            $store_domain = parse_url($store->store_url, PHP_URL_HOST);
            if ($store_domain === $domain) {
                return $store;
            }
        }

        return null;
    }

    /**
     * Check if order should be processed
     */
    private function should_process_order($order, $event_type)
    {
        // Only process completed or processing orders for stock deduction
        $processable_statuses = ['completed', 'processing'];
        
        $status = $order['status'] ?? '';
        
        if (!in_array($status, $processable_statuses)) {
            return false;
        }

        // Check if order has already been processed
        $order_id = $order['id'];
        $already_processed = $this->is_order_already_processed($order_id);
        
        return !$already_processed;
    }

    /**
     * Process order in Prokip
     */
    private function process_order_in_prokip($order, $store, $platform)
    {
        $token = $this->get_prokip_token();
        if (!$token) {
            return false;
        }

        // Prepare order data
        $prokip_order = $this->prepare_order_data($order, $store, $platform);

        // Send to Prokip
        $response = wp_remote_post($this->prokip_api_url . '/orders/process', [
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Content-Type' => 'application/json'
            ],
            'body' => json_encode($prokip_order),
            'timeout' => 30
        ]);

        if (is_wp_error($response)) {
            error_log('Prokip webhook error: ' . $response->get_error_message());
            return false;
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if ($code === 200 && isset($data['success']) && $data['success']) {
            // Mark order as processed
            $this->mark_order_as_processed($order['id'], $data['prokip_sell_id'] ?? null);
            return true;
        }

        error_log('Prokip webhook error: HTTP ' . $code . ' - ' . $body);
        return false;
    }

    /**
     * Update product in Prokip
     */
    private function update_product_in_prokip($product, $store, $platform)
    {
        $token = $this->get_prokip_token();
        if (!$token) {
            return false;
        }

        $prokip_product = $this->prepare_product_data($product, $store, $platform);

        $response = wp_remote_post($this->prokip_api_url . '/products/update', [
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
     * Delete product in Prokip
     */
    private function delete_product_in_prokip($product, $store, $platform)
    {
        $token = $this->get_prokip_token();
        if (!$token) {
            return false;
        }

        $product_id = $platform === 'woocommerce' ? $product['id'] : $product['id'];

        $response = wp_remote_request($this->prokip_api_url . '/products/' . $product_id . '/delete', [
            'method' => 'DELETE',
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Content-Type' => 'application/json'
            ],
            'timeout' => 30
        ]);

        return !is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200;
    }

    /**
     * Prepare order data for Prokip
     */
    private function prepare_order_data($order, $store, $platform)
    {
        $line_items = [];
        
        if ($platform === 'woocommerce') {
            foreach ($order['line_items'] as $item) {
                $line_items[] = [
                    'product_id' => $item['product_id'],
                    'sku' => $item['sku'] ?? '',
                    'name' => $item['name'],
                    'quantity' => $item['quantity'],
                    'price' => $item['price']
                ];
            }
            
            return [
                'order_id' => $order['id'],
                'order_number' => $order['number'],
                'customer_name' => ($order['billing']['first_name'] ?? '') . ' ' . ($order['billing']['last_name'] ?? ''),
                'customer_email' => $order['billing']['email'] ?? '',
                'total_amount' => $order['total'],
                'status' => $order['status'],
                'order_date' => $order['date_created'],
                'platform' => $platform,
                'store_id' => $store->id,
                'line_items' => $line_items
            ];
        } else {
            // Shopify
            foreach ($order['line_items'] as $item) {
                $line_items[] = [
                    'product_id' => $item['product_id'],
                    'sku' => $item['sku'] ?? '',
                    'name' => $item['name'],
                    'quantity' => $item['quantity'],
                    'price' => $item['price']
                ];
            }
            
            return [
                'order_id' => $order['id'],
                'order_number' => $order['order_number'] ?? $order['id'],
                'customer_name' => ($order['customer']['first_name'] ?? '') . ' ' . ($order['customer']['last_name'] ?? ''),
                'customer_email' => $order['customer']['email'] ?? '',
                'total_amount' => $order['total_price'],
                'status' => $order['financial_status'],
                'order_date' => $order['created_at'],
                'platform' => $platform,
                'store_id' => $store->id,
                'line_items' => $line_items
            ];
        }
    }

    /**
     * Prepare product data for Prokip
     */
    private function prepare_product_data($product, $store, $platform)
    {
        if ($platform === 'woocommerce') {
            return [
                'product_id' => $product['id'],
                'sku' => $product['sku'] ?? '',
                'name' => $product['name'],
                'price' => $product['price'] ?? 0,
                'stock_quantity' => $product['stock_quantity'] ?? 0,
                'platform' => $platform,
                'store_id' => $store->id
            ];
        } else {
            // Shopify
            $variant = $product['variants'][0] ?? [];
            return [
                'product_id' => $product['id'],
                'sku' => $variant['sku'] ?? '',
                'name' => $product['title'],
                'price' => $variant['price'] ?? 0,
                'stock_quantity' => $variant['inventory_quantity'] ?? 0,
                'platform' => $platform,
                'store_id' => $store->id
            ];
        }
    }

    /**
     * Get Prokip authentication token
     */
    private function get_prokip_token()
    {
        $token = get_option('prokip_api_token');
        
        if (!$token) {
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
     * Check if order has already been processed
     */
    private function is_order_already_processed($order_id)
    {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'prokip_processed_orders';
        
        // Create table if it doesn't exist
        $this->ensure_processed_orders_table();
        
        $result = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$table_name} WHERE order_id = %s",
            $order_id
        ));
        
        return $result > 0;
    }

    /**
     * Mark order as processed
     */
    private function mark_order_as_processed($order_id, $prokip_sell_id = null)
    {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'prokip_processed_orders';
        
        $this->ensure_processed_orders_table();
        
        $wpdb->insert(
            $table_name,
            [
                'order_id' => $order_id,
                'prokip_sell_id' => $prokip_sell_id,
                'processed_at' => current_time('mysql')
            ],
            ['%s', '%s', '%s']
        );
    }

    /**
     * Ensure processed orders table exists
     */
    private function ensure_processed_orders_table()
    {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'prokip_processed_orders';
        
        $charset_collate = $wpdb->get_charset_collate();
        
        $sql = "CREATE TABLE IF NOT EXISTS $table_name (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            order_id varchar(255) NOT NULL,
            prokip_sell_id varchar(255) DEFAULT NULL,
            processed_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY order_id (order_id)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }

    /**
     * Log webhook for debugging
     */
    private function log_webhook($platform, $headers, $payload)
    {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('Prokip Webhook: ' . $platform . ' - ' . json_encode([
                'headers' => $headers,
                'payload' => $payload
            ]));
        }
    }

    /**
     * Verify webhook signature
     */
    private function verify_webhook_signature($platform, $headers, $body)
    {
        // For WooCommerce
        if ($platform === 'woocommerce') {
            $signature = $headers['x_wc_webhook_signature'] ?? '';
            if (!$signature) {
                return true; // Skip verification if no signature
            }
            
            $secret = get_option('prokip_woo_webhook_secret');
            if (!$secret) {
                return true; // Skip verification if no secret configured
            }
            
            $expected_signature = base64_encode(hash_hmac('sha256', $body, $secret, true));
            return hash_equals($expected_signature, $signature);
        }
        
        // For Shopify
        if ($platform === 'shopify') {
            $signature = $headers['x_shopify_hmac_sha256'] ?? '';
            if (!$signature) {
                return true; // Skip verification if no signature
            }
            
            $secret = get_option('prokip_shopify_webhook_secret');
            if (!$secret) {
                return true; // Skip verification if no secret configured
            }
            
            $expected_signature = base64_encode(hash_hmac('sha256', $body, $secret, true));
            return hash_equals($expected_signature, $signature);
        }
        
        return true;
    }

    /**
     * Get WooCommerce webhook topic
     */
    private function get_woocommerce_topic($headers)
    {
        return $headers['x_wc_webhook_topic'] ?? '';
    }

    /**
     * Get Shopify webhook topic
     */
    private function get_shopify_topic($headers)
    {
        return $headers['x_shopify_topic'] ?? '';
    }
}
