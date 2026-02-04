<?php
/**
 * Cron jobs for automatic synchronization
 */

// Add custom cron schedules
add_filter('cron_schedules', 'prokip_add_cron_schedules');

function prokip_add_cron_schedules($schedules) {
    $schedules['every_15_minutes'] = [
        'interval' => 15 * 60,
        'display' => __('Every 15 Minutes', 'prokip-ecommerce')
    ];
    
    $schedules['every_30_minutes'] = [
        'interval' => 30 * 60,
        'display' => __('Every 30 Minutes', 'prokip-ecommerce')
    ];
    
    return $schedules;
}

// Schedule cron jobs on plugin activation
register_activation_hook(__FILE__, 'prokip_schedule_cron_jobs');

function prokip_schedule_cron_jobs() {
    // Schedule stock sync
    if (!wp_next_scheduled('prokip_stock_sync')) {
        $interval = get_option('prokip_sync_interval', 'hourly');
        wp_schedule_event(time(), $interval, 'prokip_stock_sync');
    }
    
    // Schedule order processing
    if (!wp_next_scheduled('prokip_process_orders')) {
        wp_schedule_event(time(), 'every_15_minutes', 'prokip_process_orders');
    }
    
    // Schedule cleanup
    if (!wp_next_scheduled('prokip_cleanup_old_data')) {
        wp_schedule_event(time(), 'daily', 'prokip_cleanup_old_data');
    }
}

// Clear cron jobs on plugin deactivation
register_deactivation_hook(__FILE__, 'prokip_clear_cron_jobs');

function prokip_clear_cron_jobs() {
    wp_clear_scheduled_hook('prokip_stock_sync');
    wp_clear_scheduled_hook('prokip_process_orders');
    wp_clear_scheduled_hook('prokip_cleanup_old_data');
}

// Add cron job actions
add_action('prokip_stock_sync', 'prokip_execute_stock_sync');
add_action('prokip_process_orders', 'prokip_execute_order_processing');
add_action('prokip_cleanup_old_data', 'prokip_execute_cleanup');

/**
 * Execute stock sync cron job
 */
function prokip_execute_stock_sync() {
    if (!get_option('prokip_auto_sync_enabled', true)) {
        return;
    }
    
    $store_model = new ProkipEcommerceStore();
    $stores = $store_model->get_enabled_stores();
    
    if (empty($stores)) {
        return;
    }
    
    $controller = new ProkipEcommerceSyncController();
    $total_updated = 0;
    $errors = [];
    
    foreach ($stores as $store) {
        try {
            $request = new WP_REST_Request('POST', [], ['store_id' => $store->id]);
            $result = $controller->sync_inventory($request);
            
            if ($result->data['success']) {
                $total_updated += $result->data['synced_count'];
            } else {
                $errors[] = "Store {$store->store_name}: " . $result->data['message'];
            }
        } catch (Exception $e) {
            $errors[] = "Store {$store->store_name}: " . $e->getMessage();
        }
    }
    
    // Log results
    prokip_log_sync_results('stock_sync', [
        'total_updated' => $total_updated,
        'stores_processed' => count($stores),
        'errors' => $errors
    ]);
}

/**
 * Execute order processing cron job
 */
function prokip_execute_order_processing() {
    if (!get_option('prokip_stock_deduction_enabled', true)) {
        return;
    }
    
    $store_model = new ProkipEcommerceStore();
    $stores = $store_model->get_enabled_stores();
    
    if (empty($stores)) {
        return;
    }
    
    $controller = new ProkipEcommerceSyncController();
    $total_processed = 0;
    $errors = [];
    
    foreach ($stores as $store) {
        try {
            // Get recent orders that haven't been processed
            $service = new ProkipEcommerceService($store->platform, [
                'store_url' => $store->store_url,
                'api_key' => $store->api_key,
                'api_secret' => $store->api_secret,
                'access_token' => $store->access_token
            ]);
            
            $orders = $service->get_orders(20, 1, 'completed');
            
            foreach ($orders as $order) {
                // Check if order was already processed
                if (!prokip_is_order_processed($order['id'])) {
                    $result = prokip_process_order_in_prokip($order, $store, $store->platform);
                    
                    if ($result) {
                        $total_processed++;
                    } else {
                        $errors[] = "Order {$order['id']} from {$store->store_name}: Processing failed";
                    }
                }
            }
        } catch (Exception $e) {
            $errors[] = "Store {$store->store_name}: " . $e->getMessage();
        }
    }
    
    // Log results
    prokip_log_sync_results('order_processing', [
        'total_processed' => $total_processed,
        'stores_processed' => count($stores),
        'errors' => $errors
    ]);
}

/**
 * Execute cleanup cron job
 */
function prokip_execute_cleanup() {
    global $wpdb;
    
    $days_to_keep = 30; // Keep data for 30 days
    
    // Clean up old webhook events
    $webhook_deleted = $wpdb->query($wpdb->prepare(
        "DELETE FROM {$wpdb->prefix}prokip_webhook_events 
         WHERE created_at < DATE_SUB(NOW(), INTERVAL %d DAY)",
        $days_to_keep
    ));
    
    // Clean up old processed orders (keep only for reference)
    $orders_deleted = $wpdb->query($wpdb->prepare(
        "DELETE FROM {$wpdb->prefix}prokip_processed_orders 
         WHERE processed_at < DATE_SUB(NOW(), INTERVAL %d DAY)",
        $days_to_keep
    ));
    
    // Log cleanup results
    prokip_log_sync_results('cleanup', [
        'webhook_events_deleted' => $webhook_deleted,
        'processed_orders_deleted' => $orders_deleted,
        'days_kept' => $days_to_keep
    ]);
}

/**
 * Check if order was already processed
 */
function prokip_is_order_processed($order_id) {
    global $wpdb;
    
    $table_name = $wpdb->prefix . 'prokip_processed_orders';
    
    $count = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM {$table_name} WHERE order_id = %s",
        $order_id
    ));
    
    return $count > 0;
}

/**
 * Process order in Prokip (extracted from webhook handler)
 */
function prokip_process_order_in_prokip($order, $store, $platform) {
    $token = get_option('prokip_api_token');
    if (!$token) {
        return false;
    }
    
    // Prepare order data
    $prokip_order = [
        'order_id' => $order['id'],
        'order_number' => $order['number'] ?? $order['id'],
        'customer_name' => ($order['billing']['first_name'] ?? '') . ' ' . ($order['billing']['last_name'] ?? ''),
        'customer_email' => $order['billing']['email'] ?? '',
        'total_amount' => $order['total'] ?? 0,
        'status' => $order['status'] ?? 'pending',
        'order_date' => $order['date_created'] ?? $order['created_at'],
        'platform' => $platform,
        'store_id' => $store->id,
        'line_items' => prokip_prepare_order_items($order['line_items'] ?? [])
    ];
    
    // Send to Prokip
    $response = wp_remote_post('https://api.prokip.africa/orders/process', [
        'headers' => [
            'Authorization' => 'Bearer ' . $token,
            'Content-Type' => 'application/json'
        ],
        'body' => json_encode($prokip_order),
        'timeout' => 30
    ]);
    
    if (is_wp_error($response)) {
        error_log('Prokip order processing error: ' . $response->get_error_message());
        return false;
    }
    
    $code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    if ($code === 200 && isset($data['success']) && $data['success']) {
        // Mark order as processed
        prokip_mark_order_as_processed($order['id'], $data['prokip_sell_id'] ?? null);
        return true;
    }
    
    error_log('Prokip order processing error: HTTP ' . $code . ' - ' . $body);
    return false;
}

/**
 * Prepare order items for Prokip
 */
function prokip_prepare_order_items($line_items) {
    $items = [];
    
    foreach ($line_items as $item) {
        $items[] = [
            'product_id' => $item['product_id'] ?? $item['id'],
            'sku' => $item['sku'] ?? '',
            'name' => $item['name'],
            'quantity' => $item['quantity'],
            'price' => $item['price']
        ];
    }
    
    return $items;
}

/**
 * Mark order as processed
 */
function prokip_mark_order_as_processed($order_id, $prokip_sell_id = null) {
    global $wpdb;
    
    $table_name = $wpdb->prefix . 'prokip_processed_orders';
    
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
 * Log sync results
 */
function prokip_log_sync_results($operation, $results) {
    if (defined('WP_DEBUG') && WP_DEBUG) {
        error_log('Prokip ' . $operation . ' results: ' . json_encode($results));
    }
    
    // You could also store these in a custom table for reporting
}

/**
 * Update cron schedule when settings change
 */
add_action('update_option_prokip_sync_interval', 'prokip_update_cron_schedule', 10, 2);

function prokip_update_cron_schedule($old_value, $new_value) {
    // Clear existing schedule
    wp_clear_scheduled_hook('prokip_stock_sync');
    
    // Schedule with new interval
    if (get_option('prokip_auto_sync_enabled', true)) {
        wp_schedule_event(time(), $new_value, 'prokip_stock_sync');
    }
}

add_action('update_option_prokip_auto_sync_enabled', 'prokip_toggle_auto_sync', 10, 2);

function prokip_toggle_auto_sync($old_value, $new_value) {
    if ($new_value) {
        // Enable auto sync
        $interval = get_option('prokip_sync_interval', 'hourly');
        if (!wp_next_scheduled('prokip_stock_sync')) {
            wp_schedule_event(time(), $interval, 'prokip_stock_sync');
        }
    } else {
        // Disable auto sync
        wp_clear_scheduled_hook('prokip_stock_sync');
    }
}
