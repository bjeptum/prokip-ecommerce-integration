<?php
/**
 * E-commerce Store Model
 * 
 * Handles database operations for connected e-commerce stores
 */

if (!defined('ABSPATH')) {
    exit;
}

class ProkipEcommerceStore
{
    private $table_name;
    private $wpdb;

    public function __construct()
    {
        global $wpdb;
        $this->wpdb = $wpdb;
        $this->table_name = $wpdb->prefix . 'prokip_ecommerce_stores';
    }

    /**
     * Create a new store connection
     */
    public function create($data)
    {
        $user_id = get_current_user_id();
        
        // Validate required fields
        if (empty($data['platform']) || empty($data['store_url'])) {
            return new WP_Error('missing_fields', 'Platform and store URL are required', ['status' => 400]);
        }

        // Check if store already exists for this user
        $existing = $this->get_by_user_store($user_id, $data['platform'], $data['store_url']);
        if ($existing) {
            return new WP_Error('store_exists', 'This store is already connected', ['status' => 409]);
        }

        // Prepare data for insertion
        $insert_data = [
            'user_id' => $user_id,
            'platform' => sanitize_text_field($data['platform']),
            'store_url' => esc_url_raw($data['store_url']),
            'store_name' => !empty($data['store_name']) ? sanitize_text_field($data['store_name']) : null,
            'sync_enabled' => isset($data['sync_enabled']) ? (bool) $data['sync_enabled'] : true,
            'created_at' => current_time('mysql'),
            'updated_at' => current_time('mysql')
        ];

        // Encrypt sensitive data
        if (!empty($data['api_key'])) {
            $insert_data['api_key'] = $this->encrypt($data['api_key']);
        }
        if (!empty($data['api_secret'])) {
            $insert_data['api_secret'] = $this->encrypt($data['api_secret']);
        }
        if (!empty($data['access_token'])) {
            $insert_data['access_token'] = $this->encrypt($data['access_token']);
        }
        if (!empty($data['refresh_token'])) {
            $insert_data['refresh_token'] = $this->encrypt($data['refresh_token']);
        }

        $result = $this->wpdb->insert($this->table_name, $insert_data);

        if ($result === false) {
            return new WP_Error('db_error', 'Failed to create store connection', ['status' => 500]);
        }

        return $this->get_by_id($this->wpdb->insert_id);
    }

    /**
     * Get store by ID
     */
    public function get_by_id($id)
    {
        $store = $this->wpdb->get_row(
            $this->wpdb->prepare(
                "SELECT * FROM {$this->table_name} WHERE id = %d",
                $id
            )
        );

        if ($store) {
            $store = $this->decrypt_store_data($store);
        }

        return $store;
    }

    /**
     * Get store by user, platform, and store URL
     */
    public function get_by_user_store($user_id, $platform, $store_url)
    {
        $store = $this->wpdb->get_row(
            $this->wpdb->prepare(
                "SELECT * FROM {$this->table_name} WHERE user_id = %d AND platform = %s AND store_url = %s",
                $user_id,
                $platform,
                $store_url
            )
        );

        if ($store) {
            $store = $this->decrypt_store_data($store);
        }

        return $store;
    }

    /**
     * Get all stores for current user
     */
    public function get_all_for_user($user_id = null)
    {
        if ($user_id === null) {
            $user_id = get_current_user_id();
        }

        $stores = $this->wpdb->get_results(
            $this->wpdb->prepare(
                "SELECT * FROM {$this->table_name} WHERE user_id = %d ORDER BY created_at DESC",
                $user_id
            )
        );

        if ($stores) {
            foreach ($stores as $store) {
                $store = $this->decrypt_store_data($store);
            }
        }

        return $stores;
    }

    /**
     * Update store
     */
    public function update($id, $data)
    {
        $update_data = [];
        $format = [];

        if (isset($data['store_name'])) {
            $update_data['store_name'] = sanitize_text_field($data['store_name']);
            $format[] = '%s';
        }

        if (isset($data['sync_enabled'])) {
            $update_data['sync_enabled'] = (bool) $data['sync_enabled'];
            $format[] = '%d';
        }

        if (isset($data['api_key'])) {
            $update_data['api_key'] = $this->encrypt($data['api_key']);
            $format[] = '%s';
        }

        if (isset($data['api_secret'])) {
            $update_data['api_secret'] = $this->encrypt($data['api_secret']);
            $format[] = '%s';
        }

        if (isset($data['access_token'])) {
            $update_data['access_token'] = $this->encrypt($data['access_token']);
            $format[] = '%s';
        }

        if (isset($data['refresh_token'])) {
            $update_data['refresh_token'] = $this->encrypt($data['refresh_token']);
            $format[] = '%s';
        }

        if (isset($data['last_sync'])) {
            $update_data['last_sync'] = $data['last_sync'];
            $format[] = '%s';
        }

        $update_data['updated_at'] = current_time('mysql');
        $format[] = '%s';

        if (empty($update_data)) {
            return new WP_Error('no_data', 'No data to update', ['status' => 400]);
        }

        $result = $this->wpdb->update(
            $this->table_name,
            $update_data,
            ['id' => $id],
            $format,
            ['%d']
        );

        if ($result === false) {
            return new WP_Error('db_error', 'Failed to update store', ['status' => 500]);
        }

        return $this->get_by_id($id);
    }

    /**
     * Delete store
     */
    public function delete($id)
    {
        $result = $this->wpdb->delete(
            $this->table_name,
            ['id' => $id],
            ['%d']
        );

        if ($result === false) {
            return new WP_Error('db_error', 'Failed to delete store', ['status' => 500]);
        }

        return true;
    }

    /**
     * Update last sync time
     */
    public function update_last_sync($id)
    {
        return $this->update($id, ['last_sync' => current_time('mysql')]);
    }

    /**
     * Get stores by platform
     */
    public function get_by_platform($platform, $user_id = null)
    {
        if ($user_id === null) {
            $user_id = get_current_user_id();
        }

        $stores = $this->wpdb->get_results(
            $this->wpdb->prepare(
                "SELECT * FROM {$this->table_name} WHERE user_id = %d AND platform = %s ORDER BY created_at DESC",
                $user_id,
                $platform
            )
        );

        if ($stores) {
            foreach ($stores as $store) {
                $store = $this->decrypt_store_data($store);
            }
        }

        return $stores;
    }

    /**
     * Get enabled stores for sync
     */
    public function get_enabled_stores($platform = null, $user_id = null)
    {
        if ($user_id === null) {
            $user_id = get_current_user_id();
        }

        $sql = "SELECT * FROM {$this->table_name} WHERE user_id = %d AND sync_enabled = 1";
        $params = [$user_id];

        if ($platform) {
            $sql .= " AND platform = %s";
            $params[] = $platform;
        }

        $sql .= " ORDER BY created_at DESC";

        $stores = $this->wpdb->get_results($this->wpdb->prepare($sql, $params));

        if ($stores) {
            foreach ($stores as $store) {
                $store = $this->decrypt_store_data($store);
            }
        }

        return $stores;
    }

    /**
     * Encrypt sensitive data
     */
    private function encrypt($data)
    {
        if (empty($data)) {
            return null;
        }

        $key = wp_salt('auth');
        $method = 'AES-256-CBC';
        $iv = openssl_random_pseudo_bytes(16);
        
        $encrypted = openssl_encrypt($data, $method, $key, 0, $iv);
        
        if ($encrypted === false) {
            return null;
        }

        return base64_encode($iv . $encrypted);
    }

    /**
     * Decrypt sensitive data
     */
    private function decrypt($encrypted_data)
    {
        if (empty($encrypted_data)) {
            return null;
        }

        $key = wp_salt('auth');
        $method = 'AES-256-CBC';
        
        $data = base64_decode($encrypted_data);
        if ($data === false) {
            return null;
        }

        $iv = substr($data, 0, 16);
        $encrypted = substr($data, 16);
        
        $decrypted = openssl_decrypt($encrypted, $method, $key, 0, $iv);
        
        return $decrypted ?: null;
    }

    /**
     * Decrypt store object data
     */
    private function decrypt_store_data($store)
    {
        if (!is_object($store)) {
            return $store;
        }

        $store->api_key = $this->decrypt($store->api_key);
        $store->api_secret = $this->decrypt($store->api_secret);
        $store->access_token = $this->decrypt($store->access_token);
        $store->refresh_token = $this->decrypt($store->refresh_token);

        return $store;
    }

    /**
     * Validate store connection
     */
    public function validate_connection($store)
    {
        $service = new ProkipEcommerceService($store->platform, [
            'store_url' => $store->store_url,
            'api_key' => $store->api_key,
            'api_secret' => $store->api_secret,
            'access_token' => $store->access_token
        ]);

        return $service->test_connection();
    }
}
