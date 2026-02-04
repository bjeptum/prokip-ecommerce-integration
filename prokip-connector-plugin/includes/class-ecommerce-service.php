<?php
/**
 * E-commerce Service
 * 
 * Handles API interactions with different e-commerce platforms
 */

if (!defined('ABSPATH')) {
    exit;
}

class ProkipEcommerceService
{
    private $platform;
    private $config;
    private $last_error;

    public function __construct($platform, $config = [])
    {
        $this->platform = strtolower($platform);
        $this->config = $config;
        $this->last_error = null;
    }

    /**
     * Test connection to the e-commerce platform
     */
    public function test_connection()
    {
        switch ($this->platform) {
            case 'woocommerce':
                return $this->test_woocommerce_connection();
            case 'shopify':
                return $this->test_shopify_connection();
            default:
                $this->last_error = 'Unsupported platform: ' . $this->platform;
                return false;
        }
    }

    /**
     * Get products from the platform
     */
    public function get_products($limit = 50, $page = 1)
    {
        switch ($this->platform) {
            case 'woocommerce':
                return $this->get_woocommerce_products($limit, $page);
            case 'shopify':
                return $this->get_shopify_products($limit, $page);
            default:
                $this->last_error = 'Unsupported platform: ' . $this->platform;
                return [];
        }
    }

    /**
     * Get orders from the platform
     */
    public function get_orders($limit = 50, $page = 1, $status = '')
    {
        switch ($this->platform) {
            case 'woocommerce':
                return $this->get_woocommerce_orders($limit, $page, $status);
            case 'shopify':
                return $this->get_shopify_orders($limit, $page, $status);
            default:
                $this->last_error = 'Unsupported platform: ' . $this->platform;
                return [];
        }
    }

    /**
     * Update product stock
     */
    public function update_product_stock($product_id, $stock_quantity, $sku = '')
    {
        switch ($this->platform) {
            case 'woocommerce':
                return $this->update_woocommerce_product_stock($product_id, $stock_quantity);
            case 'shopify':
                return $this->update_shopify_product_stock($product_id, $stock_quantity);
            default:
                $this->last_error = 'Unsupported platform: ' . $this->platform;
                return false;
        }
    }

    /**
     * Create webhook
     */
    public function create_webhook($topic, $url)
    {
        switch ($this->platform) {
            case 'woocommerce':
                return $this->create_woocommerce_webhook($topic, $url);
            case 'shopify':
                return $this->create_shopify_webhook($topic, $url);
            default:
                $this->last_error = 'Unsupported platform: ' . $this->platform;
                return false;
        }
    }

    /**
     * Get last error
     */
    public function get_last_error()
    {
        return $this->last_error;
    }

    // WooCommerce specific methods

    private function test_woocommerce_connection()
    {
        $url = rtrim($this->config['store_url'], '/') . '/wp-json/wc/v3/system_status';
        
        $response = $this->make_woocommerce_request('GET', $url);
        
        if ($response && isset($response['status']) && $response['status'] === 'ok') {
            return true;
        }

        return false;
    }

    private function get_woocommerce_products($limit = 50, $page = 1)
    {
        $url = rtrim($this->config['store_url'], '/') . '/wp-json/wc/v3/products';
        $params = [
            'per_page' => $limit,
            'page' => $page,
            'stock_status' => 'instock'
        ];

        $response = $this->make_woocommerce_request('GET', $url, $params);
        
        return $response ?: [];
    }

    private function get_woocommerce_orders($limit = 50, $page = 1, $status = '')
    {
        $url = rtrim($this->config['store_url'], '/') . '/wp-json/wc/v3/orders';
        $params = [
            'per_page' => $limit,
            'page' => $page
        ];

        if ($status) {
            $params['status'] = $status;
        }

        $response = $this->make_woocommerce_request('GET', $url, $params);
        
        return $response ?: [];
    }

    private function update_woocommerce_product_stock($product_id, $stock_quantity)
    {
        $url = rtrim($this->config['store_url'], '/') . '/wp-json/wc/v3/products/' . $product_id;
        $data = [
            'stock_quantity' => (int) $stock_quantity,
            'manage_stock' => true
        ];

        $response = $this->make_woocommerce_request('POST', $url, $data);
        
        return $response && isset($response['id']);
    }

    private function create_woocommerce_webhook($topic, $url)
    {
        $webhook_url = rtrim($this->config['store_url'], '/') . '/wp-json/wc/v3/webhooks';
        $data = [
            'name' => 'Prokip Integration - ' . $topic,
            'topic' => $topic,
            'delivery_url' => $url,
            'secret' => wp_generate_password(32, false),
            'status' => 'active'
        ];

        $response = $this->make_woocommerce_request('POST', $webhook_url, $data);
        
        return $response && isset($response['id']) ? $response : false;
    }

    private function make_woocommerce_request($method, $url, $data = [])
    {
        if (empty($this->config['api_key']) || empty($this->config['api_secret'])) {
            $this->last_error = 'Missing WooCommerce API credentials';
            return false;
        }

        $headers = [
            'Authorization' => 'Basic ' . base64_encode($this->config['api_key'] . ':' . $this->config['api_secret']),
            'Content-Type' => 'application/json',
            'User-Agent' => 'Prokip-Ecommerce/' . PROKIP_ECOMMERCE_VERSION
        ];

        $args = [
            'method' => $method,
            'headers' => $headers,
            'timeout' => 30,
            'sslverify' => true
        ];

        if (!empty($data) && $method === 'GET') {
            $url .= '?' . http_build_query($data);
        } elseif (!empty($data)) {
            $args['body'] = json_encode($data);
        }

        $response = wp_remote_request($url, $args);

        if (is_wp_error($response)) {
            $this->last_error = $response->get_error_message();
            return false;
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);

        if ($code >= 200 && $code < 300) {
            return json_decode($body, true);
        } else {
            $this->last_error = "HTTP {$code}: {$body}";
            return false;
        }
    }

    // Shopify specific methods

    private function test_shopify_connection()
    {
        $url = 'https://' . $this->config['store_url'] . '/admin/api/2023-10/shop.json';
        
        $response = $this->make_shopify_request('GET', $url);
        
        if ($response && isset($response['shop'])) {
            return true;
        }

        return false;
    }

    private function get_shopify_products($limit = 50, $page = 1)
    {
        $url = 'https://' . $this->config['store_url'] . '/admin/api/2023-10/products.json';
        $params = [
            'limit' => $limit,
            'page_info' => $page > 1 ? $page : null
        ];

        $response = $this->make_shopify_request('GET', $url, $params);
        
        return $response && isset($response['products']) ? $response['products'] : [];
    }

    private function get_shopify_orders($limit = 50, $page = 1, $status = '')
    {
        $url = 'https://' . $this->config['store_url'] . '/admin/api/2023-10/orders.json';
        $params = [
            'limit' => $limit,
            'status' => $status ?: 'any'
        ];

        $response = $this->make_shopify_request('GET', $url, $params);
        
        return $response && isset($response['orders']) ? $response['orders'] : [];
    }

    private function update_shopify_product_stock($product_id, $stock_quantity)
    {
        // First get the product to find its variant
        $product_url = 'https://' . $this->config['store_url'] . '/admin/api/2023-10/products/' . $product_id . '.json';
        $product_response = $this->make_shopify_request('GET', $product_url);
        
        if (!$product_response || !isset($product_response['product']['variants'][0])) {
            return false;
        }

        $variant_id = $product_response['product']['variants'][0]['id'];
        
        $url = 'https://' . $this->config['store_url'] . '/admin/api/2023-10/variants/' . $variant_id . '.json';
        $data = [
            'variant' => [
                'inventory_quantity' => (int) $stock_quantity,
                'inventory_management' => 'shopify'
            ]
        ];

        $response = $this->make_shopify_request('PUT', $url, $data);
        
        return $response && isset($response['variant']['id']);
    }

    private function create_shopify_webhook($topic, $url)
    {
        $webhook_url = 'https://' . $this->config['store_url'] . '/admin/api/2023-10/webhooks.json';
        $data = [
            'webhook' => [
                'topic' => $topic,
                'address' => $url,
                'format' => 'json'
            ]
        ];

        $response = $this->make_shopify_request('POST', $webhook_url, $data);
        
        return $response && isset($response['webhook']['id']) ? $response['webhook'] : false;
    }

    private function make_shopify_request($method, $url, $data = [])
    {
        if (empty($this->config['access_token'])) {
            $this->last_error = 'Missing Shopify access token';
            return false;
        }

        $headers = [
            'X-Shopify-Access-Token' => $this->config['access_token'],
            'Content-Type' => 'application/json',
            'User-Agent' => 'Prokip-Ecommerce/' . PROKIP_ECOMMERCE_VERSION
        ];

        $args = [
            'method' => $method,
            'headers' => $headers,
            'timeout' => 30,
            'sslverify' => true
        ];

        if (!empty($data) && $method === 'GET') {
            $url .= '?' . http_build_query(array_filter($data));
        } elseif (!empty($data)) {
            $args['body'] = json_encode($data);
        }

        $response = wp_remote_request($url, $args);

        if (is_wp_error($response)) {
            $this->last_error = $response->get_error_message();
            return false;
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);

        if ($code >= 200 && $code < 300) {
            return json_decode($body, true);
        } else {
            $this->last_error = "HTTP {$code}: {$body}";
            return false;
        }
    }
}
