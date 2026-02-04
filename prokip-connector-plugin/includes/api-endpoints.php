<?php
/**
 * Additional REST API endpoints for Prokip E-commerce Integration
 */

// Add these endpoints to the main plugin file's register_rest_routes method

// Test connection endpoint
register_rest_route('prokip-ecommerce/v1', '/test-connection', [
    'methods' => 'POST',
    'callback' => 'prokip_test_connection',
    'permission_callback' => function() {
        return current_user_can('manage_options');
    }
]);

// Test store connection endpoint
register_rest_route('prokip-ecommerce/v1', '/test-store-connection', [
    'methods' => 'POST',
    'callback' => 'prokip_test_store_connection',
    'permission_callback' => function() {
        return current_user_can('manage_options');
    }
]);

// Sync all endpoints
register_rest_route('prokip-ecommerce/v1', '/sync-all-inventory', [
    'methods' => 'POST',
    'callback' => 'prokip_sync_all_inventory',
    'permission_callback' => function() {
        return current_user_can('manage_options');
    }
]);

register_rest_route('prokip-ecommerce/v1', '/sync-all-products', [
    'methods' => 'POST',
    'callback' => 'prokip_sync_all_products',
    'permission_callback' => function() {
        return current_user_can('manage_options');
    }
]);

register_rest_route('prokip-ecommerce/v1', '/sync-all-orders', [
    'methods' => 'POST',
    'callback' => 'prokip_sync_all_orders',
    'permission_callback' => function() {
        return current_user_can('manage_options');
    }
]);

// Activity log endpoint
register_rest_route('prokip-ecommerce/v1', '/activity', [
    'methods' => 'GET',
    'callback' => 'prokip_get_activity',
    'permission_callback' => function() {
        return current_user_can('manage_options');
    }
]);

// Stock check endpoint
register_rest_route('prokip-ecommerce/v1', '/stock/check', [
    'methods' => 'POST',
    'callback' => 'prokip_check_stock',
    'permission_callback' => '__return_true'
]);

// Product sync endpoint
register_rest_route('prokip-ecommerce/v1', '/products/sync', [
    'methods' => 'POST',
    'callback' => 'prokip_sync_products_frontend',
    'permission_callback' => '__return_true'
]);

register_rest_route('prokip-ecommerce/v1', '/products/(?P<id>\d+)/sync', [
    'methods' => 'POST',
    'callback' => 'prokip_sync_single_product_frontend',
    'permission_callback' => '__return_true'
]);

// Updates endpoint for real-time polling
register_rest_route('prokip-ecommerce/v1', '/updates', [
    'methods' => 'GET',
    'callback' => 'prokip_get_updates',
    'permission_callback' => '__return_true'
]);

/**
 * Test connection to e-commerce platform
 */
function prokip_test_connection(WP_REST_Request $request) {
    $platform = $request['platform'];
    $store_url = $request['store_url'];
    $api_key = $request['api_key'];
    $api_secret = $request['api_secret'];

    $service = new ProkipEcommerceService($platform, [
        'store_url' => $store_url,
        'api_key' => $api_key,
        'api_secret' => $api_secret
    ]);

    if ($service->test_connection()) {
        return [
            'success' => true,
            'message' => 'Connection successful!'
        ];
    } else {
        return new WP_Error('connection_failed', 'Connection failed: ' . $service->get_last_error(), ['status' => 400]);
    }
}

/**
 * Test existing store connection
 */
function prokip_test_store_connection(WP_REST_Request $request) {
    $store_id = $request['store_id'];
    
    $store_model = new ProkipEcommerceStore();
    $store = $store_model->get_by_id($store_id);
    
    if (!$store) {
        return new WP_Error('store_not_found', 'Store not found', ['status' => 404]);
    }

    $service = new ProkipEcommerceService($store->platform, [
        'store_url' => $store->store_url,
        'api_key' => $store->api_key,
        'api_secret' => $store->api_secret,
        'access_token' => $store->access_token
    ]);

    if ($service->test_connection()) {
        return [
            'success' => true,
            'message' => 'Connection successful!'
        ];
    } else {
        return new WP_Error('connection_failed', 'Connection failed: ' . $service->get_last_error(), ['status' => 400]);
    }
}

/**
 * Sync inventory from Prokip to all stores
 */
function prokip_sync_all_inventory(WP_REST_Request $request) {
    $store_model = new ProkipEcommerceStore();
    $stores = $store_model->get_enabled_stores();
    
    if (empty($stores)) {
        return new WP_Error('no_stores', 'No enabled stores found', ['status' => 404]);
    }

    $controller = new ProkipEcommerceSyncController();
    $total_synced = 0;
    $errors = [];

    foreach ($stores as $store) {
        $result = $controller->sync_inventory(new WP_REST_Request('POST', [], ['store_id' => $store->id]));
        
        if ($result->data['success']) {
            $total_synced += $result->data['synced_count'];
        } else {
            $errors[] = "Store {$store->store_name}: " . $result->data['message'];
        }
    }

    return [
        'success' => true,
        'message' => "Synced inventory for {$total_synced} products across " . count($stores) . " stores",
        'total_synced' => $total_synced,
        'stores_processed' => count($stores),
        'errors' => $errors
    ];
}

/**
 * Sync products from all stores to Prokip
 */
function prokip_sync_all_products(WP_REST_Request $request) {
    $store_model = new ProkipEcommerceStore();
    $stores = $store_model->get_enabled_stores();
    
    if (empty($stores)) {
        return new WP_Error('no_stores', 'No enabled stores found', ['status' => 404]);
    }

    $controller = new ProkipEcommerceSyncController();
    $total_synced = 0;
    $errors = [];

    foreach ($stores as $store) {
        $result = $controller->sync_products(new WP_REST_Request('POST', [], ['store_id' => $store->id]));
        
        if ($result->data['success']) {
            $total_synced += $result->data['synced_count'];
        } else {
            $errors[] = "Store {$store->store_name}: " . $result->data['message'];
        }
    }

    return [
        'success' => true,
        'message' => "Synced {$total_synced} products from " . count($stores) . " stores",
        'total_synced' => $total_synced,
        'stores_processed' => count($stores),
        'errors' => $errors
    ];
}

/**
 * Sync orders from all stores to Prokip
 */
function prokip_sync_all_orders(WP_REST_Request $request) {
    $store_model = new ProkipEcommerceStore();
    $stores = $store_model->get_enabled_stores();
    
    if (empty($stores)) {
        return new WP_Error('no_stores', 'No enabled stores found', ['status' => 404]);
    }

    $controller = new ProkipEcommerceSyncController();
    $total_synced = 0;
    $errors = [];

    foreach ($stores as $store) {
        $result = $controller->sync_orders(new WP_REST_Request('POST', [], ['store_id' => $store->id]));
        
        if ($result->data['success']) {
            $total_synced += $result->data['synced_count'];
        } else {
            $errors[] = "Store {$store->store_name}: " . $result->data['message'];
        }
    }

    return [
        'success' => true,
        'message' => "Synced {$total_synced} orders from " . count($stores) . " stores",
        'total_synced' => $total_synced,
        'stores_processed' => count($stores),
        'errors' => $errors
    ];
}

/**
 * Get recent activity
 */
function prokip_get_activity(WP_REST_Request $request) {
    global $wpdb;
    
    $activities = [];
    
    // Get recent webhook events
    $webhook_events = $wpdb->get_results("
        SELECT 
            we.event_type,
            we.created_at,
            es.store_name,
            es.platform
        FROM {$wpdb->prefix}prokip_webhook_events we
        LEFT JOIN {$wpdb->prefix}prokip_ecommerce_stores es ON we.connection_id = es.id
        WHERE we.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        ORDER BY we.created_at DESC
        LIMIT 10
    ");
    
    foreach ($webhook_events as $event) {
        $activities[] = [
            'time' => date_i18n(get_option('time_format'), strtotime($event->created_at)),
            'message' => "Webhook received: {$event->event_type} from {$event->store_name} ({$event->platform})",
            'type' => 'webhook'
        ];
    }
    
    // Get recent sync operations
    $sync_logs = $wpdb->get_results("
        SELECT 
            'Inventory Sync' as activity_type,
            last_sync as created_at,
            store_name,
            platform
        FROM {$wpdb->prefix}prokip_ecommerce_stores
        WHERE last_sync > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        ORDER BY last_sync DESC
        LIMIT 5
    ");
    
    foreach ($sync_logs as $log) {
        $activities[] = [
            'time' => date_i18n(get_option('time_format'), strtotime($log->created_at)),
            'message' => "Inventory sync completed for {$log->store_name} ({$log->platform})",
            'type' => 'sync'
        ];
    }
    
    // Sort by time
    usort($activities, function($a, $b) {
        return strtotime($b['time']) - strtotime($a['time']);
    });
    
    return [
        'success' => true,
        'activities' => array_slice($activities, 0, 10)
    ];
}

/**
 * Check stock levels for products
 */
function prokip_check_stock(WP_REST_Request $request) {
    $product_ids = $request['product_ids'];
    
    if (empty($product_ids)) {
        return new WP_Error('missing_products', 'No product IDs provided', ['status' => 400]);
    }
    
    $stock_levels = [];
    
    foreach ($product_ids as $product_id) {
        // Get stock from Prokip
        $stock = get_prokip_stock_for_product($product_id);
        $stock_levels[] = [
            'product_id' => $product_id,
            'quantity' => $stock
        ];
    }
    
    return [
        'success' => true,
        'stock_levels' => $stock_levels
    ];
}

/**
 * Sync products for frontend
 */
function prokip_sync_products_frontend(WP_REST_Request $request) {
    $product_ids = $request['product_ids'];
    
    if (empty($product_ids)) {
        return new WP_Error('missing_products', 'No product IDs provided', ['status' => 400]);
    }
    
    $products = [];
    
    foreach ($product_ids as $product_id) {
        $product = get_product_from_prokip($product_id);
        if ($product) {
            $products[] = $product;
        }
    }
    
    return [
        'success' => true,
        'products' => $products
    ];
}

/**
 * Sync single product for frontend
 */
function prokip_sync_single_product_frontend(WP_REST_Request $request) {
    $product_id = $request['id'];
    
    $product = get_product_from_prokip($product_id);
    
    if ($product) {
        return [
            'success' => true,
            'product' => $product
        ];
    } else {
        return new WP_Error('sync_failed', 'Failed to sync product', ['status' => 500]);
    }
}

/**
 * Get updates for real-time polling
 */
function prokip_get_updates(WP_REST_Request $request) {
    $updates = [];
    
    // This would typically check for recent updates in the database
    // For now, return empty array
    
    return [
        'success' => true,
        'updates' => $updates
    ];
}

/**
 * Helper function to get stock from Prokip
 */
function get_prokip_stock_for_product($product_id) {
    $token = get_option('prokip_api_token');
    if (!$token) {
        return 0;
    }
    
    $response = wp_remote_get('https://api.prokip.africa/products/' . $product_id . '/stock', [
        'headers' => [
            'Authorization' => 'Bearer ' . $token,
            'Content-Type' => 'application/json'
        ],
        'timeout' => 10
    ]);
    
    if (!is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200) {
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        return $data['stock_quantity'] ?? 0;
    }
    
    return 0;
}

/**
 * Helper function to get product from Prokip
 */
function get_product_from_prokip($product_id) {
    $token = get_option('prokip_api_token');
    if (!$token) {
        return null;
    }
    
    $response = wp_remote_get('https://api.prokip.africa/products/' . $product_id, [
        'headers' => [
            'Authorization' => 'Bearer ' . $token,
            'Content-Type' => 'application/json'
        ],
        'timeout' => 10
    ]);
    
    if (!is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200) {
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        return [
            'id' => $data['id'],
            'name' => $data['name'],
            'sku' => $data['sku'] ?? '',
            'price' => $data['price'] ?? 0,
            'stock_quantity' => $data['stock_quantity'] ?? 0,
            'last_sync' => current_time('mysql')
        ];
    }
    
    return null;
}
